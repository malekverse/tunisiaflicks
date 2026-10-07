"use client"
import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { CONTACT_TOPICS } from '@/src/lib/contact'
import { translateApiMessage, type TKey } from '@/src/lib/i18n'

type Kind = 'contact' | 'dmca'
type Status = 'idle' | 'sending' | 'sent' | 'error'

const field = 'w-full rounded-xl border bg-white dark:bg-[#1a161f] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500'
const ok = 'border-gray-300 dark:border-zinc-700'
const bad = 'border-red-500'

/** Contact form, or (kind="dmca") a structured copyright notice. Posts to /api/contact. */
export default function ContactForm({ kind }: { kind: Kind }) {
  const t = useT()
  const { data: session } = useSession()
  const [values, setValues] = useState({ name: '', email: '', topic: 'general', message: '', work: '', urls: '', signature: '', website: '' })
  const [checks, setChecks] = useState({ goodFaith: false, accurate: false })
  const [invalid, setInvalid] = useState<string[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  // Signed-in users don't retype who they are.
  useEffect(() => {
    if (!session?.user) return
    setValues((current) => ({
      ...current,
      name: current.name || session.user?.name || '',
      email: current.email || session.user?.email || '',
    }))
  }, [session])

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }))
    setInvalid((current) => current.filter((name) => name !== key))
  }
  const cls = (name: string) => `${field} ${invalid.includes(name) ? bad : ok}`

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ...values, ...checks }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setStatus('sent')
        return
      }
      setStatus('error')
      if (data.fields) {
        setInvalid(data.fields)
        setError(t('form.invalid'))
      } else {
        setError(translateApiMessage(t, data.message) ?? t('form.failed'))
      }
    } catch {
      setStatus('error')
      setError(t('form.failed'))
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-green-600/40 bg-green-600/10 p-5 text-sm" role="status">
        <p>{t(kind === 'dmca' ? 'dmca.sent' : 'form.sent')}</p>
        <button
          type="button"
          className="mt-3 text-red-500 hover:underline"
          onClick={() => {
            setStatus('idle')
            setValues((current) => ({ ...current, message: '', work: '', urls: '' }))
            setChecks({ goodFaith: false, accurate: false })
          }}
        >
          {t('form.sendAnother')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {/* Honeypot: hidden from people (and screen readers); bots fill it in. */}
      <div aria-hidden="true" className="absolute -start-[10000px] h-px w-px overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} /></label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t('form.name')}
          <input className={`mt-1 ${cls('name')}`} value={values.name} onChange={set('name')} autoComplete="name" required maxLength={100} />
        </label>
        <label className="block text-sm font-medium">
          {t('form.email')}
          <input type="email" dir="ltr" className={`mt-1 ${cls('email')}`} value={values.email} onChange={set('email')} autoComplete="email" required maxLength={200} />
        </label>
      </div>

      {kind === 'contact' ? (
        <label className="block text-sm font-medium">
          {t('form.topic')}
          <select className={`mt-1 ${cls('topic')}`} value={values.topic} onChange={set('topic')}>
            {CONTACT_TOPICS.map((topic) => <option key={topic} value={topic}>{t(`form.topic.${topic}` as TKey)}</option>)}
          </select>
        </label>
      ) : (
        <>
          <label className="block text-sm font-medium">
            {t('dmca.work')}
            <input className={`mt-1 ${cls('work')}`} value={values.work} onChange={set('work')} placeholder={t('dmca.workPlaceholder')} maxLength={1000} required />
          </label>
          <label className="block text-sm font-medium">
            {t('dmca.urls')}
            <textarea dir="ltr" rows={3} className={`mt-1 ${cls('urls')}`} value={values.urls} onChange={set('urls')} maxLength={2000} required />
            <span className="mt-1 block text-xs font-normal text-gray-500">{t('dmca.urlsHelp')}</span>
          </label>
        </>
      )}

      <label className="block text-sm font-medium">
        {kind === 'dmca' ? t('dmca.details') : t('form.message')}
        <textarea rows={6} className={`mt-1 ${cls('message')}`} value={values.message} onChange={set('message')} maxLength={5000} required />
      </label>

      {kind === 'dmca' && (
        <>
          {(['goodFaith', 'accurate'] as const).map((name) => (
            <label key={name} className={`flex items-start gap-3 text-sm ${invalid.includes(name) ? 'text-red-500' : ''}`}>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-red-500"
                checked={checks[name]}
                onChange={(event) => {
                  setChecks((current) => ({ ...current, [name]: event.target.checked }))
                  setInvalid((current) => current.filter((item) => item !== name))
                }}
              />
              <span>{t(name === 'goodFaith' ? 'dmca.goodFaith' : 'dmca.accurate')}</span>
            </label>
          ))}
          <label className="block text-sm font-medium">
            {t('dmca.signature')}
            <input className={`mt-1 ${cls('signature')}`} value={values.signature} onChange={set('signature')} maxLength={100} required />
          </label>
        </>
      )}

      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

      <Button type="submit" disabled={status === 'sending'} className="bg-red-500 text-white hover:bg-red-400">
        {status === 'sending' ? t('form.sending') : t(kind === 'dmca' ? 'dmca.send' : 'form.send')}
      </Button>
    </form>
  )
}
