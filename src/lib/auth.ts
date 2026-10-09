// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { ObjectId } from 'mongodb';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import clientPromise from '@/src/lib/mongodb';
import { compare } from 'bcrypt';
import { clientIp, normalizeEmail, rateLimitAll } from '@/src/lib/rate-limit';
import { findUserByEmail } from '@/src/lib/users';
import { consumePairing, isDeviceCode } from '@/src/lib/tv-pairing';
import { TV_SESSION_CHECK_MS, createTvSession, touchTvSession } from '@/src/lib/tv-sessions';

/** What the 'tv-pair' provider hands to the jwt callback (see below). */
type TvPairUser = { id: string; name: string | null; email: string | null; scope: 'tv'; pairingId: string; pinnedProfileId: string };

/**
 * A TV signs in with the deviceCode of a pairing a phone approved (src/lib/tv-pairing.ts): the
 * pairing goes approved → used atomically, a revocable tvSessions entry is made, and the session is
 * scoped 'tv', pinned to the approved profile (src/lib/session-scope.ts).
 */
async function authorizeTvPairing(deviceCode: unknown): Promise<TvPairUser | null> {
  if (!isDeviceCode(deviceCode)) return null;
  const pairing = await consumePairing(deviceCode);
  if (!pairing?.userId || !pairing.profileId || !ObjectId.isValid(pairing.userId)) return null;
  const client = await clientPromise;
  const user = await client.db().collection('users').findOne(
    { _id: new ObjectId(pairing.userId) },
    { projection: { name: 1, email: 1, profiles: 1 } },
  );
  // The profile may have been deleted in the meantime.
  if (!user || !(user.profiles ?? []).some((profile: { id?: unknown }) => String(profile.id) === pairing.profileId)) return null;
  const pairingId = await createTvSession({ userId: pairing.userId, profileId: pairing.profileId, deviceLabel: pairing.deviceLabel });
  return {
    id: pairing.userId,
    name: user.name || null,
    email: user.email || null,
    scope: 'tv',
    pairingId,
    pinnedProfileId: pairing.profileId,
  };
}

// "Continue with Google" switches on only when both env vars are set (see README).
export const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  providers: [
    ...(googleEnabled
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          // Google only hands out verified addresses, so it is safe to attach a Google sign-in to an
          // existing email/password account with the same email instead of failing.
          allowDangerousEmailAccountLinking: true,
        })]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // Brute-force protection: per account and per IP. The login page shows a friendly message.
        const limit = await rateLimitAll([
          [`login:email:${normalizeEmail(credentials.email)}`, 8, 15 * 60],
          [`login:ip:${clientIp(req?.headers ?? {})}`, 30, 15 * 60],
        ]);
        if (!limit.ok) throw new Error('TooManyAttempts');

        // Case-insensitive, so "Ali@x.com" can log in as "ali@x.com".
        const user = await findUserByEmail(credentials.email);

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
    // A TV signed in from a phone (/activate): see authorizeTvPairing.
    CredentialsProvider({
      id: 'tv-pair',
      name: 'TV pairing',
      credentials: { deviceCode: { label: 'Device code', type: 'text' } },
      async authorize(credentials) {
        return authorizeTvPairing(credentials?.deviceCode);
      },
    }),
  ],
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: 'jwt' }, // Use JWT strategy
  // Errors (e.g. a cancelled Google sign-in) come back to the login page, which explains them.
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async signIn({ account, profile }) {
      // Only accept Google accounts whose email Google has verified.
      if (account?.provider === 'google') return (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      return true;
    },
    async jwt({ token, user, account }) {
      // next-auth copies the user's picture into the token before this callback runs. Uploaded
      // avatars are data URLs (up to ~700 KB), and a Google sign-in passes the full database user,
      // so the session cookie would balloon until Vercel rejects every request (494). The picture
      // is never needed here (the UI loads it from /api/user): always drop it.
      delete token.picture;
      if (user) {
        // Only include essential data in the token
        token.id = user.id;
        token.email = user.email;
        token.name = user.name || null;
        // Do not include the image in the token
        const tv = user as Partial<TvPairUser>;
        if (account?.provider === 'tv-pair' && tv.scope === 'tv') {
          // A TV: scoped, pinned to one profile, never a fresh sign-in (no loginAt).
          token.scope = 'tv';
          token.pairingId = tv.pairingId;
          token.pinnedProfileId = tv.pinnedProfileId;
          token.checkedAt = Date.now();
          delete token.loginAt;
        } else {
          // When the password was last typed: a fresh sign-in may pick a grown-up profile without it.
          token.loginAt = Date.now();
          delete token.scope;
          delete token.pairingId;
          delete token.pinnedProfileId;
          delete token.checkedAt;
          delete token.revoked;
        }
        return token;
      }
      // A TV signed out from Settings #security stays signed out (see the session callback).
      if (token.revoked) return { revoked: true };
      // A TV: every 5 minutes, check it hasn't been signed out (and note when it was last seen).
      if (token.scope === 'tv' && (typeof token.checkedAt !== 'number' || Date.now() - token.checkedAt > TV_SESSION_CHECK_MS)) {
        const alive = await touchTvSession(token.pairingId);
        if (alive === false) return { revoked: true };
        if (alive) token.checkedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      // A revoked TV gets an empty session, which next-auth treats as signed out on the server
      // (getServerSession returns null) and in the browser (useSession is 'unauthenticated').
      if (token.revoked) return {} as typeof session;
      if (session.user) {
        // Only include essential data in the session
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        // Do not include the image in the session
      }
      session.loginAt = token.loginAt;
      // A TV signed in with a code gets a limited session (see lib/session-scope): carry its scope.
      session.scope = token.scope;
      session.pinnedProfileId = token.pinnedProfileId;
      return session;
    },
  },
  events: {
    // A Google sign-in proves the address: mark it verified (and use the Google photo if none yet).
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google' || !ObjectId.isValid(user.id)) return;
      const client = await clientPromise;
      const users = client.db().collection('users');
      const current = await users.findOne({ _id: new ObjectId(user.id) }, { projection: { emailVerified: 1, image: 1 } });
      const set: Record<string, unknown> = {};
      if (!current?.emailVerified) set.emailVerified = new Date();
      const picture = (profile as { picture?: string } | undefined)?.picture;
      if (!current?.image && picture) set.image = picture;
      if (Object.keys(set).length) await users.updateOne({ _id: new ObjectId(user.id) }, { $set: set });
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};