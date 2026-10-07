"use client"
import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import { useT } from '@/src/components/I18nProvider'
import { EMAIL_RE, Field, FormNotice, SubmitButton, SuccessCheck, focusFirst, invalidClass } from '@/src/components/auth/fields'
import { CONTACT_TOPICS } from '@/src/lib/contact'
import { translateApiMessage, type TKey } from '@/src/lib/i18n'
import { EASE_OUT } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

type Kind = 'contact' | 'dmca'
type Status = 'idle' | 'sending' | 'sent' | 'error'
type Values = { name: string, email: string, topic: string, message: string, work: string, urls: string, signature: string, website: string }
type Checks = { goodFaith: boolean, accurate: boolean }

// What each field needs, mirroring /api/contact (which stays the judge), and what to say if not.
const RULES: Record<string, { test: (values: Values, checks: Checks) => boolean, message: TKey, dmcaOnly?: boolean }> = {
  name: { test: (v) => v.name.trim().length >= 2, message: 'form.err.name' },
  email: { test: (v) => EMAIL_RE.test(v.email.trim()), message: 'form.err.email' },
  work: { test: (v) => v.work.trim().length >= 3, message: 'form.err.required', dmcaOnly: true },
  urls: { test: (v) => v.urls.trim().length >= 5, message: 'form.err.required', dmcaOnly: true },
  message: { test: (v) => v.message.trim().length >= 10, message: 'form.err.message' },
  goodFaith: { test: (_, c) => c.goodFaith, message: 'form.err.confirm', dmcaOnly: true },
  accurate: { test: (_, c) => c.accurate, message: 'form.err.confirm', dmcaOnly: true },
  signature: { test: (v) => v.signature.trim().length >= 2, message: 'form.err.name', dmcaOnly: true },
}

const swap = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.32, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.16, ease: EASE_OUT } },
}

/** Contact form, or (kind="dmca") a structured copyright notice. Posts to /api/contact. */
export default function ContactForm({ kind }: { kind: Kind }) {
  const t = useT()
  const { data: session } = useSession()
  const [values, setValues] = useState<Values>({ name: '', email: '', topic: 'general', message: '', work: '', urls: '', signature: '', website: '' })
  const [checks, setChecks] = useState<Checks>({ goodFaith: false, accurate: false })
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

  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }))
    setInvalid((current) => current.filter((name) => name !== key))
  }
  const errorFor = (name: string) => (invalid.includes(name) ? t(RULES[name]?.message ?? 'form.err.required') : null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (status === 'sending') return
    setError(null)
    // Catch the obvious before the round trip; the server checks again.
    const missing = Object.keys(RULES).filter((name) => (kind === 'dmca' || !RULES[name].dmcaOnly) && !RULES[name].test(values, checks))
    if (missing.length) {
      setInvalid(missing)
      focusFirst(missing)
      return
    }
    setStatus('sending')
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
        focusFirst(data.fields)
      } else {
        setError(translateApiMessage(t, data.message) ?? t('form.failed'))
      }
    } catch {
      setStatus('error')
      setError(t('form.failed'))
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {status === 'sent' ? (
        <m.div key="sent" {...swap} role="status" className="flex flex-col items-start py-2">
          <SuccessCheck className="mb-6" />
          <p className="font-display text-[26px] font-bold leading-tight text-white">{t(kind === 'dmca' ? 'dmca.sentTitle' : 'form.sentTitle')}</p>
          <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-white/65">{t(kind === 'dmca' ? 'dmca.sent' : 'form.sent')}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-7"
            onClick={() => {
              setStatus('idle')
              setValues((current) => ({ ...current, message: '', work: '', urls: '' }))
              setChecks({ goodFaith: false, accurate: false })
            }}
          >
            {t('form.sendAnother')}
          </Button>
        </m.div>
      ) : (
        <m.form key="form" {...swap} onSubmit={submit} noValidate className="relative space-y-5">
          {/* Honeypot: hidden from people (and screen readers); bots fill it in. */}
          <div aria-hidden="true" className="absolute -start-[10000px] h-px w-px overflow-hidden">
            <label>Website<input tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} /></label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="name" label={t('form.name')} error={errorFor('name')}>
              {(a11y) => (
                <Input {...a11y} className={invalidClass} value={values.name} onChange={set('name')} autoComplete="name" autoCapitalize="words" enterKeyHint="next" required maxLength={100} />
              )}
            </Field>
            <Field id="email" label={t('form.email')} error={errorFor('email')}>
              {(a11y) => (
                <Input
                  {...a11y}
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  className={cn('rtl:text-right', invalidClass)}
                  value={values.email}
                  onChange={set('email')}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  required
                  maxLength={200}
                />
              )}
            </Field>
          </div>

          {kind === 'contact' ? (
            <Field id="topic" label={t('form.topic')}>
              {(a11y) => (
                <div className="relative">
                  <select
                    {...a11y}
                    className="flex h-11 w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-white/[0.05] pe-11 ps-4 text-[15px] text-white outline-none transition-[border-color,background-color,box-shadow] duration-200 hover:border-white/20 focus-visible:border-red-500/70 focus-visible:bg-white/[0.07] focus-visible:ring-4 focus-visible:ring-red-500/15 [&>option]:bg-neutral-900"
                    value={values.topic}
                    onChange={set('topic')}
                  >
                    {CONTACT_TOPICS.map((topic) => <option key={topic} value={topic}>{t(`form.topic.${topic}` as TKey)}</option>)}
                  </select>
                  <ChevronDown aria-hidden className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                </div>
              )}
            </Field>
          ) : (
            <>
              <Field id="work" label={t('dmca.work')} error={errorFor('work')}>
                {(a11y) => (
                  <Input {...a11y} className={invalidClass} value={values.work} onChange={set('work')} placeholder={t('dmca.workPlaceholder')} maxLength={1000} required />
                )}
              </Field>
              <Field id="urls" label={t('dmca.urls')} error={errorFor('urls')} hint={t('dmca.urlsHelp')}>
                {(a11y) => (
                  <Textarea {...a11y} dir="ltr" rows={3} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={cn('min-h-0 rtl:text-right', invalidClass)} value={values.urls} onChange={set('urls')} maxLength={2000} required />
                )}
              </Field>
            </>
          )}

          <Field id="message" label={kind === 'dmca' ? t('dmca.details') : t('form.message')} error={errorFor('message')}>
            {(a11y) => (
              <Textarea {...a11y} rows={6} className={cn('min-h-[148px] resize-y', invalidClass)} value={values.message} onChange={set('message')} maxLength={5000} required />
            )}
          </Field>

          {kind === 'dmca' && (
            <>
              {(['goodFaith', 'accurate'] as const).map((name) => {
                const problem = errorFor(name)
                return (
                  <div key={name}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-2xl p-4 text-[14px] leading-relaxed ring-1 ring-inset transition-colors duration-200',
                        problem ? 'bg-red-500/[0.05] text-white/85 ring-red-400/40' : checks[name] ? 'bg-white/[0.06] text-white/85 ring-white/15' : 'bg-white/[0.03] text-white/70 ring-white/[0.08] hover:ring-white/15',
                      )}
                    >
                      <input
                        id={name}
                        type="checkbox"
                        aria-invalid={!!problem}
                        aria-describedby={problem ? `${name}-error` : undefined}
                        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-red-500"
                        checked={checks[name]}
                        onChange={(event) => {
                          setChecks((current) => ({ ...current, [name]: event.target.checked }))
                          setInvalid((current) => current.filter((item) => item !== name))
                        }}
                      />
                      <span>{t(name === 'goodFaith' ? 'dmca.goodFaith' : 'dmca.accurate')}</span>
                    </label>
                    {problem && <p id={`${name}-error`} className="pt-2 text-[13px] text-red-400">{problem}</p>}
                  </div>
                )
              })}
              <Field id="signature" label={t('dmca.signature')} error={errorFor('signature')}>
                {(a11y) => (
                  <Input {...a11y} className={invalidClass} value={values.signature} onChange={set('signature')} autoComplete="name" maxLength={100} required />
                )}
              </Field>
            </>
          )}

          <div className="pt-1">
            <FormNotice message={error} className="pb-5" />
            <SubmitButton loading={status === 'sending'} loadingText={t('form.sending')} className="w-full sm:w-auto sm:min-w-[200px]">
              {t(kind === 'dmca' ? 'dmca.send' : 'form.send')}
            </SubmitButton>
          </div>
        </m.form>
      )}
    </AnimatePresence>
  )
}
