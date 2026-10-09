"use client"
// "Amel, Sami and you": the people in a list, in the viewer's language (Intl.ListFormat), each name
// isolated in <bdi> so an Arabic name in an English sentence (or the reverse) keeps its order.
import { Fragment } from 'react'
import { useI18n } from '@/src/components/I18nProvider'
import { htmlLang } from '@/src/lib/i18n/locales'
import type { AvatarPerson } from '@/src/lib/social/types'
import type { SharedListMember } from '@/src/lib/shared-lists/types'

const MAX_NAMES = 3

/** The members to show, the owner first and the viewer last (as "you"). */
export function orderedMembers(members: SharedListMember[]): SharedListMember[] {
  return [...members].sort((a, b) => Number(a.you) - Number(b.you) || (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0))
}

export function useNameParts(members: SharedListMember[], people: Record<string, AvatarPerson>) {
  const { t, locale } = useI18n()
  const ordered = orderedMembers(members)
  const names = ordered.map((member) => (member.you ? t('sharedLists.people.youInList') : people[member.id]?.name ?? '?'))
  const shown = names.length > MAX_NAMES ? [...names.slice(0, MAX_NAMES - 1), t('sharedLists.people.more', { count: names.length - (MAX_NAMES - 1) })] : names
  let parts: { type: string; value: string }[]
  try {
    parts = new Intl.ListFormat(htmlLang(locale), { style: 'long', type: 'conjunction' }).formatToParts(shown)
  } catch {
    parts = shown.flatMap((value, index) => (index ? [{ type: 'literal', value: ', ' }, { type: 'element', value }] : [{ type: 'element', value }]))
  }
  return { parts, text: parts.map((part) => part.value).join('') }
}

export default function PeopleNames({ members, people, className }: { members: SharedListMember[]; people: Record<string, AvatarPerson>; className?: string }) {
  const { parts } = useNameParts(members, people)
  return (
    <span className={className}>
      {parts.map((part, index) => (part.type === 'element' ? <bdi key={index}>{part.value}</bdi> : <Fragment key={index}>{part.value}</Fragment>))}
    </span>
  )
}
