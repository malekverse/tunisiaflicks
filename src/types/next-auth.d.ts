import { DefaultSession, DefaultUser } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      phone?: string
      birthdate?: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    phone?: string
    birthdate?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    phone?: string
    birthdate?: string
  }
}

