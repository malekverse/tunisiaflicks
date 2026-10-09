"use client"
// "TVs signed in" under Settings #security (AccountSecurity's securityExtra): the TVs signed in
// with a code from a phone, each with its profile, when it was signed in and last used, and
// [Sign out] (it notices within 5 minutes). A TV itself only gets a note: it can't manage TVs.
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { LoaderCircle, Tv } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { toast } from '@/src/hooks/use-toast'
import { dateLocale } from '@/src/lib/i18n/locales'
import type { TKey } from '@/src/lib/i18n'

type Item = { id: string; deviceLabel: string; profileName: string | null; createdAt: string; lastSeenAt: string }
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'limited' } | { kind: 'ready'; sessions: Item[]; canRevoke: boolean }

export default function TvSessionsSetting(): JSX.Element | null {
  const { t, locale } = useI18n()
  const { data: session, status } = useSession()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/tv/sessions', { cache: 'no-store' })
      if (response.status === 403) return setState({ kind: 'limited' })
      if (!response.ok) return setState({ kind: 'error' })
      const body = await response.json()
      setState({ kind: 'ready', sessions: body.sessions ?? [], canRevoke: !!body.canRevoke })
    } catch {
      setState({ kind: 'error' })
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    if (session?.scope === 'tv') setState({ kind: 'limited' })
    else load()
  }, [status, session?.scope, load])

  if (status !== 'authenticated') return null

  const date = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(dateLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
    } catch {
      return iso.slice(0, 10)
    }
  }
  const device = (label: string) => t(`tvMode.device.${label}` as TKey)

  const signOut = async (item: Item) => {
    setPending(item.id)
    const response = await fetch(`/api/tv/sessions?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' }).catch(() => null)
    setPending(null)
    if (!response?.ok) {
      toast({ title: t('common.error'), description: t('tvMode.sessions.failed'), variant: 'destructive' })
      return
    }
    setState((current) => current.kind === 'ready' ? { ...current, sessions: current.sessions.filter((other) => other.id !== item.id) } : current)
    toast({ title: t('tvMode.sessions.signedOut') })
  }

  return (
    <div className="max-w-2xl">
      <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-white">
        <Tv aria-hidden className="h-[18px] w-[18px] text-white/70" />
        {t('tvMode.sessions.title')}
      </h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-white/55">{t('tvMode.sessions.desc')}</p>

      <div className="mt-4">
        {state.kind === 'loading' && (
          <div aria-busy className="flex h-[68px] items-center gap-3 rounded-2xl bg-white/[0.03] px-4 text-[14px] text-white/55 ring-1 ring-inset ring-white/[0.05]">
            <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        )}
        {state.kind === 'limited' && (
          <p className="rounded-2xl bg-white/[0.03] px-4 py-3.5 text-[14px] text-white/65 ring-1 ring-inset ring-white/[0.05]">{t('tvMode.sessions.limited')}</p>
        )}
        {state.kind === 'error' && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-inset ring-white/[0.05]">
            <p className="text-[14px] text-white/65">{t('tvMode.sessions.loadFailed')}</p>
            <Button variant="secondary" size="sm" className="h-9" onClick={() => { setState({ kind: 'loading' }); load() }}>{t('error.retry')}</Button>
          </div>
        )}
        {state.kind === 'ready' && state.sessions.length === 0 && (
          <div className="rounded-2xl bg-white/[0.03] px-4 py-3.5 ring-1 ring-inset ring-white/[0.05]">
            <p className="text-[14px] font-medium text-white/80">{t('tvMode.sessions.empty')}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-white/55">{t('tvMode.sessions.howTo')}</p>
          </div>
        )}
        {state.kind === 'ready' && state.sessions.length > 0 && (
          <ul className="divide-y divide-white/[0.07] rounded-2xl bg-white/[0.03] px-4 ring-1 ring-inset ring-white/[0.05]">
            {state.sessions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/85">
                  <Tv aria-hidden className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-white">
                    {device(item.deviceLabel)}
                    {item.profileName && <span className="ms-2 text-[13px] font-normal text-white/55">{t('tvMode.sessions.profile', { name: item.profileName })}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-white/55">
                    <span>{t('tvMode.sessions.since', { date: date(item.createdAt) })}</span>
                    <span>{t('tvMode.sessions.lastSeen', { date: date(item.lastSeenAt) })}</span>
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-10 px-4"
                  disabled={!state.canRevoke || pending === item.id}
                  aria-label={t('tvMode.sessions.signOutAria', { device: device(item.deviceLabel) })}
                  onClick={() => signOut(item)}
                >
                  {pending === item.id && <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />}
                  {t('tvMode.sessions.signOut')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {state.kind === 'ready' && state.sessions.length > 0 && !state.canRevoke && (
          <p className="mt-2 text-[13px] text-white/55">{t('tvMode.sessions.kids')}</p>
        )}
      </div>
    </div>
  )
}
