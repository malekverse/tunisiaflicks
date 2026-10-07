// app/api/auth/reset-password/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { hash } from 'bcrypt';
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // Token guessing protection.
    const limit = await rateLimit(`reset:ip:${clientIp(request.headers)}`, 10, 15 * 60);
    if (!limit.ok) return tooManyRequests(limit.retryAfter);

    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { message: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    // Find the user with the valid reset token that hasn't expired
    const user = await db.collection('users').findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await hash(password, 10);

    // Update the user's password and remove the reset token fields
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
        $unset: {
          resetToken: "",
          resetTokenExpiry: "",
        },
      }
    );

    return NextResponse.json(
      { message: 'Password has been reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in reset password:', error);
    return NextResponse.json(
      { message: 'An error occurred while resetting your password' },
      { status: 500 }
    );
  }
}