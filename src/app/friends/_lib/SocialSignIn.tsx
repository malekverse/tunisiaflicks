"use client"
// The signed-out state of a social page: SignInInvite with the page's own icon (icons are
// components, so server pages name them instead of passing them).
import { Bell, UserRound, UsersRound } from 'lucide-react'
import SignInInvite from '@/src/components/library/SignInInvite'

const ICONS = { friends: UsersRound, me: UserRound, bell: Bell } as const

export default function SocialSignIn({ icon, title, text, callbackUrl }: { icon: keyof typeof ICONS; title: string; text: string; callbackUrl: string }) {
  return <SignInInvite icon={ICONS[icon]} title={title} text={text} callbackUrl={callbackUrl} />
}
