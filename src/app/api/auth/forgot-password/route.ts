// app/api/auth/forgot-password/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/src/lib/email';
import { clientIp, normalizeEmail, rateLimitAll, tooManyRequests } from '@/src/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Stops reset-email flooding of one inbox and scripted probing from one IP.
    const limit = await rateLimitAll([
      [`forgot:ip:${clientIp(request.headers)}`, 5, 15 * 60],
      [`forgot:email:${normalizeEmail(email)}`, 3, 60 * 60],
    ]);
    if (!limit.ok) return tooManyRequests(limit.retryAfter);

    const client = await clientPromise;
    const db = client.db();

    // Find the user by email
    const user = await db.collection('users').findOne({ email });

    // Don't reveal if the user exists or not for security reasons
    if (!user) {
      return NextResponse.json(
        { message: 'If your email is registered, you will receive a password reset link' },
        { status: 200 }
      );
    }

    // Generate a reset token
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Update the user with the reset token and expiry
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          resetToken,
          resetTokenExpiry,
        },
      }
    );

    // Send the password reset email
    await sendPasswordResetEmail(email, resetToken);

    return NextResponse.json(
      { message: 'If your email is registered, you will receive a password reset link' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in forgot password:', error);
    return NextResponse.json(
      { message: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}