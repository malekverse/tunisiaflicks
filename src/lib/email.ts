import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import clientPromise from '@/src/lib/mongodb';

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

/** The branded dark shell shared by every TunisiaFlicks email (logo header, red accent, footer). */
function emailLayout(heading: string, content: string) {
  return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #121212; color: #e0e0e0; border-radius: 8px; overflow: hidden; border: 1px solid #333;">
          <!-- Header with Logo -->
          <div style="text-align: center; padding: 20px; background-color: #1a1a1a; border-bottom: 2px solid #ff1000;">
            <img src="https://tunisiaflicks.vercel.app/TunisiaFlicks.png" alt="TunisiaFlicks Logo" width="200" height="30" style="margin: 0 auto;">
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            <h2 style="color: #ffffff; margin-top: 0; font-size: 24px; text-align: center;">${heading}</h2>
            ${content}
          </div>

          <!-- Footer -->
          <div style="background-color: #1a1a1a; padding: 20px; text-align: center; border-top: 1px solid #333;">
            <p style="color: #888888; font-size: 14px; margin: 0;">© ${new Date().getFullYear()} TunisiaFlicks. All rights reserved.</p>
          </div>
        </div>
      `;
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

const BUTTON_STYLE = 'background-color: #ff1000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;';

export async function sendVerificationEmail(email: string, token: string) {
  const { from, appUrl } = requireEmailEnv();

  try {
    const transporter = createTransporter();

    // Email content
    const mailOptions = {
      from,
      to: email,
      subject: 'Verify your email address',
      text: `Please click on the following link to verify your email address: ${appUrl}/auth/verify-email?token=${token}`,
      html: emailLayout('Email Verification', `
            <p style="color: #e0e0e0; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">Thank you for registering with TunisiaFlicks. Please click the button below to verify your email address:</p>

            <!-- Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/auth/verify-email?token=${token}" style="${BUTTON_STYLE}">Verify Email</a>
            </div>

            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5; margin-top: 25px;">If you did not create an account, please ignore this email or contact support if you have concerns.</p>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5;">This link will expire in 24 hours for security reasons.</p>`),
    };

    // Send email
    await reserveMail('transactional');
    await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully');
  } catch (error: any) {
    console.error('Error sending verification email', error);
    throw new Error('Failed to send verification email: ' + (error.message || 'Unknown error'));
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const { from, appUrl } = requireEmailEnv();

  try {
    const transporter = createTransporter();

    // Email content
    const mailOptions = {
      from,
      to: email,
      subject: 'Reset Your Password',
      text: `You requested a password reset for your TunisiaFlicks account. Please click on the following link to reset your password: ${appUrl}/auth/reset-password?token=${token}. This link will expire in 1 hour for security reasons. If you did not request this password reset, please ignore this email or contact support.`,
      html: emailLayout('Password Reset Request', `
            <p style="color: #e0e0e0; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">You've requested to reset your password for your TunisiaFlicks account. Please click the button below to create a new password:</p>

            <!-- Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/auth/reset-password?token=${token}" style="${BUTTON_STYLE}">Reset Password</a>
            </div>

            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5; margin-top: 25px;">If you did not request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5;">This link will expire in 1 hour for security reasons.</p>`),
    };

    // Send email
    await reserveMail('transactional');
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully');
  } catch (error: any) {
    console.error('Error sending password reset email', error);
    throw new Error('Failed to send password reset email: ' + (error.message || 'Unknown error'));
  }
}

export type ReleaseAlert = {
  media_type: 'movie' | 'tv';
  tmdbId: string;
  title: string;
  poster_path?: string | null;
  /** e.g. "Out now" or "New episode: S02E05 · The Return" */
  headline: string;
};

/**
 * One email listing every followed title that was released / got a new episode since the last run.
 * Bulk mail: 'quota' (nothing sent) once today's bulk budget is spent.
 */
export async function sendReleaseAlertsEmail(email: string, name: string | null | undefined, alerts: ReleaseAlert[]): Promise<'sent' | 'quota' | 'empty'> {
  const { appUrl } = requireEmailEnv();
  if (alerts.length === 0) return 'empty';

  const single = alerts.length === 1;
  const subject = single
    ? (alerts[0].media_type === 'movie' ? `${alerts[0].title} is out now` : `New episode of ${alerts[0].title}`)
    : `${alerts.length} titles you follow have something new`;
  const intro = single ? 'A title you follow has something new:' : 'Titles you follow have something new:';
  const link = (alert: ReleaseAlert) => `${appUrl}/${alert.media_type}/${alert.tmdbId}`;
  const manageUrl = `${appUrl}/profile#following`;

  const rows = alerts.map((alert) => `
            <tr>
              <td width="72" style="padding: 12px 12px 12px 0; vertical-align: top;">
                <a href="${link(alert)}"><img src="${alert.poster_path ? `https://image.tmdb.org/t/p/w154${alert.poster_path}` : 'https://tunisiaflicks.vercel.app/404.png'}" alt="" width="60" style="width: 60px; border-radius: 6px; display: block;"></a>
              </td>
              <td style="padding: 12px 0; vertical-align: top; border-bottom: 1px solid #2a2a2a;">
                <a href="${link(alert)}" style="color: #ffffff; font-size: 17px; font-weight: bold; text-decoration: none;">${escapeHtml(alert.title)}</a>
                <p style="color: #a0a0a0; font-size: 14px; line-height: 1.4; margin: 6px 0 10px;">${escapeHtml(alert.headline)}</p>
                <a href="${link(alert)}" style="color: #ff1000; font-size: 14px; font-weight: bold; text-decoration: none;">Watch now &rarr;</a>
              </td>
            </tr>`).join('');

  const html = emailLayout('New on your watchlist', `
            <p style="color: #e0e0e0; font-size: 16px; line-height: 1.5; margin-bottom: 10px;">${name ? `Hi ${escapeHtml(name)},` : 'Hi,'}</p>
            <p style="color: #e0e0e0; font-size: 16px; line-height: 1.5; margin-bottom: 15px;">${intro}</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">${rows}
            </table>

            <!-- Button -->
            <div style="text-align: center; margin: 30px 0 10px;">
              <a href="${appUrl}" style="${BUTTON_STYLE}">Open TunisiaFlicks</a>
            </div>

            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5; margin-top: 25px;">You're receiving this because you follow these titles on TunisiaFlicks. <a href="${manageUrl}" style="color: #a0a0a0;">Manage your alerts</a></p>`);

  const text = [
    name ? `Hi ${name},` : 'Hi,',
    '',
    intro,
    '',
    ...alerts.map((alert) => `- ${alert.title}: ${alert.headline}\n  ${link(alert)}`),
    '',
    `Manage your alerts: ${manageUrl}`,
  ].join('\n');

  return sendBulkMail({ to: email, subject, text, html });
}

export type ContactMessage = {
  kind: 'contact' | 'dmca'
  name: string
  email: string
  topic?: string
  message: string
  work?: string
  urls?: string
  signature?: string
}

/**
 * Forwards a contact-form or DMCA message to the site owner (CONTACT_EMAIL, never shown on the
 * site). Reply-To is the sender, so answering the email answers them.
 */
export async function sendContactEmail(msg: ContactMessage) {
  const { from } = requireEmailEnv();
  const to = process.env.CONTACT_EMAIL || process.env.FROM_EMAIL;
  if (!to) throw new Error('Email configuration error');

  const isDmca = msg.kind === 'dmca';
  const subject = isDmca ? `[DMCA] Copyright notice from ${msg.name}` : `[Contact${msg.topic ? `: ${msg.topic}` : ''}] Message from ${msg.name}`;
  const rows: [string, string | undefined][] = [
    ['From', `${msg.name} <${msg.email}>`],
    ['Topic', msg.topic],
    ['Copyrighted work', msg.work],
    ['Reported URLs', msg.urls],
    ['Signature', msg.signature],
  ];
  const present = rows.filter(([, value]) => value);
  const text = `${present.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${msg.message}`;
  const html = emailLayout(isDmca ? 'Copyright (DMCA) notice' : 'New contact message', `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              ${present.map(([label, value]) => `<tr><td style="color: #a0a0a0; padding: 6px 12px 6px 0; vertical-align: top; white-space: nowrap;">${label}</td><td style="color: #ffffff; padding: 6px 0; white-space: pre-wrap;">${escapeHtml(value!)}</td></tr>`).join('')}
            </table>
            <div style="background-color: #1a1a1a; border-radius: 6px; padding: 16px; color: #e0e0e0; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(msg.message)}</div>`);

  await reserveMail('transactional');
  await createTransporter().sendMail({ from, to, replyTo: `"${msg.name.replace(/"/g, '')}" <${msg.email}>`, subject, text, html });
}
