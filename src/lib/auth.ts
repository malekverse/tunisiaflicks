// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import clientPromise from '@/src/lib/mongodb';
import { compare } from 'bcrypt';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const client = await clientPromise;
        const user = await client.db().collection('users').findOne({ email: credentials.email });

        if (!user || !(await compare(credentials.password, user.password))) return null;

        // Return only essential user data (exclude the image)
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name || null,
          image: null, // Exclude the image from the JWT
        };
      },
    }),
  ],
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: 'jwt' }, // Use JWT strategy
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Only include essential data in the token
        token.id = user.id;
        token.email = user.email;
        token.name = user.name || null;
        // Do not include the image in the token
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Only include essential data in the session
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        // Do not include the image in the session
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};