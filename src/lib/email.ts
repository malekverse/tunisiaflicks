import nodemailer from 'nodemailer';

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

function escapeHtml(value: string) {
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
function requireEmailEnv() {
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

/** One email listing every followed title that was released / got a new episode since the last run. */
export async function sendReleaseAlertsEmail(email: string, name: string | null | undefined, alerts: ReleaseAlert[]) {
  const { from, appUrl } = requireEmailEnv();
  if (alerts.length === 0) return;

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

  await createTransporter().sendMail({ from, to: email, subject, text, html });
}
