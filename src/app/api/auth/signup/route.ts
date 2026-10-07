// app/api/auth/signup/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { hash } from 'bcrypt';
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit';
import { startEmailVerification } from '@/src/lib/verification';
import { findUserByEmail } from '@/src/lib/users';

export async function POST(request: Request) {
  try {
    // Account-spam protection: a handful of signups per IP per hour.
    const limit = await rateLimit(`signup:ip:${clientIp(request.headers)}`, 5, 60 * 60);
    if (!limit.ok) return tooManyRequests(limit.retryAfter);

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Missing required fields' },
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

    // Case-insensitive: "Ali@x.com" and "ali@x.com" are the same person.
    const existingUser = await findUserByEmail(String(email));
    if (existingUser) {
      return NextResponse.json(
        { message: 'User already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 10);
    const { insertedId } = await db.collection('users').insertOne({
      name,
      email: String(email).trim(),
      password: hashedPassword,
      emailVerified: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Soft verification: the account works right away; the link just confirms the address.
    await startEmailVerification(insertedId, String(email).trim());

    return NextResponse.json(
      { message: 'User created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { message: 'Error creating user' },
      { status: 500 }
    );
  }
}