import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

export async function sendVerificationEmail(email: string, token: string) {
  const msg = {
    to: email,
    from: process.env.FROM_EMAIL as string,
    subject: 'Verify your email address',
    text: `Please click on the following link to verify your email address: ${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}`,
    html: `<p>Please click on the following link to verify your email address:</p>
           <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}">Verify Email</a></p>`,
  };

  try {
    await sgMail.send(msg);
    console.log('Verification email sent successfully');
  } catch (error) {
    console.error('Error sending verification email', error);
    throw new Error('Failed to send verification email');
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const msg = {
    to: email,
    from: process.env.FROM_EMAIL as string,
    subject: 'Reset your password',
    text: `Please click on the following link to reset your password: ${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`,
    html: `<p>Please click on the following link to reset your password:</p>
           <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}">Reset Password</a></p>`,
  };

  try {
    await sgMail.send(msg);
    console.log('Password reset email sent successfully');
  } catch (error) {
    console.error('Error sending password reset email', error);
    throw new Error('Failed to send password reset email');
  }
}