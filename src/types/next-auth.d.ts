import { DefaultSession, DefaultUser } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      phone?: string
      birthdate?: string
    } & DefaultSession["user"]
    loginAt?: number
    /** 'tv': a TV signed in with a pairing code. A limited session (src/lib/session-scope.ts). */
    scope?: 'tv'
    /** For a TV session: the only profile it may use (approved on the phone). */
    pinnedProfileId?: string
  }

  interface User extends DefaultUser {
    phone?: string
    birthdate?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    loginAt?: number
    phone?: string
    birthdate?: string
    /** See Session.scope. A TV token never has loginAt (it never counts as a fresh sign-in). */
    scope?: 'tv'
    pinnedProfileId?: string
    /** TV sessions (tv-mode): which pairing made it, when it was last re-checked, and whether it was revoked. */
    pairingId?: string
    checkedAt?: number
    revoked?: boolean
  }
}
