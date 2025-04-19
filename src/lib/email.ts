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

export async function sendVerificationEmail(email: string, token: string) {
  // Validate required environment variables
  if (!process.env.FROM_EMAIL) {
    console.error('FROM_EMAIL environment variable is missing');
    throw new Error('Email configuration error');
  }
  
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error('NEXT_PUBLIC_APP_URL environment variable is missing');
    throw new Error('Email configuration error');
  }

  try {
    // Create a transporter
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    // Email content
    const mailOptions = {
      from: `"TunisiaFlicks" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Verify your email address',
      text: `Please click on the following link to verify your email address: ${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #121212; color: #e0e0e0; border-radius: 8px; overflow: hidden; border: 1px solid #333;">
          <!-- Header with Logo -->
          <div style="text-align: center; padding: 20px; background-color: #1a1a1a; border-bottom: 2px solid #ff1000;">
            <img src="https://tunisiaflicks.vercel.app/TunisiaFlicks.png" alt="TunisiaFlicks Logo" width="200" height="30" style="margin: 0 auto;">
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            <h2 style="color: #ffffff; margin-top: 0; font-size: 24px; text-align: center;">Email Verification</h2>
            <p style="color: #e0e0e0; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">Thank you for registering with TunisiaFlicks. Please click the button below to verify your email address:</p>
            
            <!-- Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}" style="background-color: #ff1000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Verify Email</a>
            </div>
            
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5; margin-top: 25px;">If you did not create an account, please ignore this email or contact support if you have concerns.</p>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5;">This link will expire in 24 hours for security reasons.</p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #1a1a1a; padding: 20px; text-align: center; border-top: 1px solid #333;">
            <p style="color: #888888; font-size: 14px; margin: 0;">© ${new Date().getFullYear()} TunisiaFlicks. All rights reserved.</p>
          </div>
        </div>
      `,
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
  // Validate required environment variables
  if (!process.env.FROM_EMAIL) {
    console.error('FROM_EMAIL environment variable is missing');
    throw new Error('Email configuration error');
  }
  
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error('NEXT_PUBLIC_APP_URL environment variable is missing');
    throw new Error('Email configuration error');
  }

  try {
    // Create a transporter
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    // Email content
    const mailOptions = {
      from: `"TunisiaFlicks" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Reset Your Password',
      text: `You requested a password reset for your TunisiaFlicks account. Please click on the following link to reset your password: ${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}. This link will expire in 1 hour for security reasons. If you did not request this password reset, please ignore this email or contact support.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #121212; color: #e0e0e0; border-radius: 8px; overflow: hidden; border: 1px solid #333;">
           <!-- Header with Logo -->
           <div style="text-align: center; padding: 20px; background-color: #1a1a1a; border-bottom: 2px solid #ff1000;">
            <img src="https://tunisiaflicks.vercel.app/TunisiaFlicks.png" alt="TunisiaFlicks Logo" width="200" height="30" style="margin: 0 auto;">
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            <h2 style="color: #ffffff; margin-top: 0; font-size: 24px; text-align: center;">Password Reset Request</h2>
            <p style="color: #e0e0e0; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">You've requested to reset your password for your TunisiaFlicks account. Please click the button below to create a new password:</p>
            
            <!-- Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}" style="background-color: #ff1000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Reset Password</a>
            </div>
            
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5; margin-top: 25px;">If you did not request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5;">This link will expire in 1 hour for security reasons.</p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #1a1a1a; padding: 20px; text-align: center; border-top: 1px solid #333;">
            <p style="color: #888888; font-size: 14px; margin: 0;">© ${new Date().getFullYear()} TunisiaFlicks. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully');
  } catch (error: any) {
    console.error('Error sending password reset email', error);
    throw new Error('Failed to send password reset email: ' + (error.message || 'Unknown error'));
  }
}