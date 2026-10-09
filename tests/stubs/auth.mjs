// Stand-in for '@/src/lib/auth' in unit tests: no providers (next-auth's CommonJS modules don't
// load in plain Node), and no session, so getServerSession answers null.
export const authOptions = { providers: [] }
