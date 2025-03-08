// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/src/lib/auth'; // Import authOptions

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };