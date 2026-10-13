import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import clientPromise from '@/src/lib/mongodb';
import type { Locale } from '@/src/lib/i18n/locales';
import { contactEmail, passwordResetEmail, releaseAlertsEmail, verificationEmail, type ContactMessage, type ReleaseAlert } from '@/src/lib/account-emails';

// Environment variables for email configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');


// Validate email configuration
if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST) {
  console.error('Email configuration is missing. Please check EMAIL_USER, EMAIL_PASS, and EMAIL_HOST environment variables.');
}

function createTransporter() {
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465, // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

/** Whether e-mail can be sent at all (SMTP settings, the From address and the site URL). */
export function emailConfigured() {
  return !!(EMAIL_HOST && EMAIL_USER && EMAIL_PASS && process.env.FROM_EMAIL && process.env.NEXT_PUBLIC_APP_URL);
}

// ---- The day's mail budget -------------------------------------------------------------------
// Free SMTP plans cap a day's sends (Gmail: ~500). One counter per UTC day, shared by every kind of
// mail and every serverless instance, in the rateLimits collection (removed by its TTL index).
// Bulk mail (release alerts, the weekly digest) stops 70 short of the cap so account mail
// (verification, password reset, contact) always gets through.

/** Sends kept for account mail. */
export const MAIL_RESERVED_FOR_ACCOUNTS = 70;

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** The SMTP plan's daily cap (MAIL_DAILY_LIMIT, default 450). */
export const mailDailyLimit = () => positiveInt(process.env.MAIL_DAILY_LIMIT, 450);

type DayCounter = { _id: string; count: number; expiresAt: Date };

let counterIndexReady: Promise<unknown> | null = null;

async function dayCounters() {
  const counters = (await clientPromise).db().collection<DayCounter>('rateLimits');
  counterIndexReady ??= counters.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => { counterIndexReady = null; });
  await counterIndexReady;
  return counters;
}

const utcDay = () => new Date().toISOString().slice(0, 10);
const dayKey = (name: string) => `mail:${name}:${utcDay()}`;
// Kept a day past the day it counts, then dropped.
const counterExpiry = () => new Date(Date.parse(`${utcDay()}T00:00:00Z`) + 2 * 86400000);
const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;

/**
 * Takes one of today's `cap` slots of the counter `name` (mail:<name>:<UTC date>); false when
 * they're all taken. Atomic across instances: the increment only matches while count < cap, and a
 * full counter makes the upsert collide with the existing document (duplicate key).
 */
export async function reserveDailySlot(name: string, cap: number): Promise<boolean> {
  if (cap <= 0) return false;
  const _id = dayKey(name);
  const counters = await dayCounters();
  try {
    await counters.updateOne({ _id, count: { $lt: cap } }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: counterExpiry() } }, { upsert: true });
    return true;
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    // Either the counter is full, or two instances created it at the same moment: try once more.
    const retry = await counters.updateOne({ _id, count: { $lt: cap } }, { $inc: { count: 1 } });
    return retry.modifiedCount === 1;
  }
}

/**
 * Counts one mail against today's budget (mail:day:<UTC date>). Bulk mail gets false once the
 * count reaches MAIL_DAILY_LIMIT - 70 (and when the counter can't be reached); account mail
 * ('transactional') always gets true, and still counts.
 */
export async function reserveMail(kind: 'bulk' | 'transactional'): Promise<boolean> {
  if (kind === 'transactional') {
    try {
      const counters = await dayCounters();
      await counters.updateOne({ _id: dayKey('day') }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: counterExpiry() } }, { upsert: true });
    } catch (error) {
      // Never hold back a password reset because the counter is unreachable.
      if (!isDuplicateKey(error)) console.error('Mail budget: counting an account mail failed', error);
    }
    return true;
  }
  try {
    return await reserveDailySlot('day', mailDailyLimit() - MAIL_RESERVED_FOR_ACCOUNTS);
  } catch (error) {
    console.error('Mail budget unavailable, holding bulk mail back:', error);
    return false;
  }
}

let pooled: nodemailer.Transporter | null = null;

/**
 * The transport for bulk mail: a small pool (2 connections) throttled to 5 messages a second, so a
 * run never trips the SMTP provider's rate limits. Kept for the life of the instance.
 */
export function bulkTransport(): nodemailer.Transporter {
  pooled ??= nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    pool: true,
    maxConnections: 2,
    rateDelta: 1000,
    rateLimit: 5,
  });
  return pooled;
}

/**
 * Sends one bulk message (From is filled in) after taking a slot of today's bulk budget.
 * 'quota' (nothing sent) when the budget is spent; SMTP errors are thrown.
 */
export async function sendBulkMail(message: Mail.Options): Promise<'sent' | 'quota'> {
  const { from } = requireEmailEnv();
  if (!(await reserveMail('bulk'))) return 'quota';
  await bulkTransport().sendMail({ from, ...message });
  return 'sent';
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The From / app URL settings every email needs. */
export function requireEmailEnv() {
  // Validate required environment variables
  if (!process.env.FROM_EMAIL) {
    console.error('FROM_EMAIL environment variable is missing');
    throw new Error('Email configuration error');
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error('NEXT_PUBLIC_APP_URL environment variable is missing');
    throw new Error('Email configuration error');
  }

  return { from: `"TunisiaFlicks" <${process.env.FROM_EMAIL}>`, appUrl: process.env.NEXT_PUBLIC_APP_URL };
}

// ---- The account e-mails (content and layout: lib/account-emails, lib/email-kit) ---------------

export type { ContactMessage, ReleaseAlert, ReleaseEvent } from '@/src/lib/account-emails';

/** The language of the request being answered (the language switch's cookie, or the browser's); none outside a request. */
async function requestLocale(): Promise<Locale | undefined> {
  try {
    const { getLocale } = await import('@/src/lib/i18n/server');
    return getLocale();
  } catch {
    return undefined;
  }
}

/** "Confirm your e-mail", in the viewer's language (`locale`, else the request's, else English). */
export async function sendVerificationEmail(email: string, token: string, locale?: Locale) {
  const { from, appUrl } = requireEmailEnv();
  try {
    const { subject, html, text } = verificationEmail({ locale: locale ?? await requestLocale(), appUrl, token });
    await reserveMail('transactional');
    await createTransporter().sendMail({ from, to: email, subject, text, html });
    console.log('Verification email sent successfully');
  } catch (error: any) {
    console.error('Error sending verification email', error);
    throw new Error('Failed to send verification email: ' + (error.message || 'Unknown error'));
  }
}

/** "Choose a new password", in the viewer's language (`locale`, else the request's, else English). */
export async function sendPasswordResetEmail(email: string, token: string, locale?: Locale) {
  const { from, appUrl } = requireEmailEnv();
  try {
    const { subject, html, text } = passwordResetEmail({ locale: locale ?? await requestLocale(), appUrl, token });
    await reserveMail('transactional');
    await createTransporter().sendMail({ from, to: email, subject, text, html });
    console.log('Password reset email sent successfully');
  } catch (error: any) {
    console.error('Error sending password reset email', error);
    throw new Error('Failed to send password reset email: ' + (error.message || 'Unknown error'));
  }
}

/**
 * One email listing every followed title that was released / got a new episode since the last run,
 * in the account's language. Bulk mail: 'quota' (nothing sent) once today's bulk budget is spent.
 */
export async function sendReleaseAlertsEmail(email: string, alerts: ReleaseAlert[], locale?: Locale): Promise<'sent' | 'quota' | 'empty'> {
  const { appUrl } = requireEmailEnv();
  if (alerts.length === 0) return 'empty';
  const { subject, html, text } = releaseAlertsEmail({ locale, appUrl, alerts });
  return sendBulkMail({ to: email, subject, text, html });
}

/**
 * Forwards a contact-form or DMCA message to the site owner (CONTACT_EMAIL, never shown on the
 * site). Reply-To is the sender, so answering the email answers them.
 */
export async function sendContactEmail(msg: ContactMessage) {
  const { from, appUrl } = requireEmailEnv();
  const to = process.env.CONTACT_EMAIL || process.env.FROM_EMAIL;
  if (!to) throw new Error('Email configuration error');
  const { subject, html, text } = contactEmail({ appUrl, msg });
  await reserveMail('transactional');
  await createTransporter().sendMail({ from, to, replyTo: `"${msg.name.replace(/"/g, '')}" <${msg.email}>`, subject, text, html });
}
