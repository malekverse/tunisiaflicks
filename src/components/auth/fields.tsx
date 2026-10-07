"use client"
// Form pieces shared by the sign-in pages and the contact forms: labelled fields with inline
// errors, a password input with a show/hide toggle, a button that spins without changing size, an
// animated notice, and the "done" check.
import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { AlertCircle, Eye, EyeOff, Info, Loader2 } from 'lucide-react'
import { Button, type ButtonProps } from '@/src/components/ui/button'
import { Input, type InputProps } from '@/src/components/ui/input'
import { useT } from '@/src/components/I18nProvider'
import { EASE_OUT, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

/** Same rule as the API (/api/contact). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Puts the keyboard on the first field that needs attention. */
export function focusFirst(ids: string[]) {
  const element = ids.map((id) => document.getElementById(id)).find(Boolean)
  element?.focus()
}

export type FieldA11y = { id: string, 'aria-invalid': boolean, 'aria-describedby'?: string }

/**
 * A visible label over its control, an optional hint, and the field's error under it. The control
 * is a render prop so it gets the id and the aria wiring (invalid state, described by hint/error).
 */
export function Field({ id, label, error, hint, aside, className, children }: {
  id: string
  label: React.ReactNode
  error?: string | null
  hint?: React.ReactNode
  /** Something at the end of the label row (e.g. "Forgot your password?"). */
  aside?: React.ReactNode
  className?: string
  children: (a11y: FieldA11y) => React.ReactNode
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-white/70">{label}</label>
        {aside}
      </div>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {hint && !error && <div id={`${id}-hint`} className="mt-2 text-[13px] text-white/50">{hint}</div>}
      <AnimatePresence initial={false}>
        {error && (
          <m.p
            key="error"
            id={`${id}-error`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, transition: tween.fast }}
            transition={tween.base}
            className="overflow-hidden text-[13px] text-red-400"
          >
            <span className="block pt-2">{error}</span>
          </m.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Red edge on fields that need fixing (pass to Input/Textarea className). */
export const invalidClass = 'aria-[invalid=true]:border-red-400/60 aria-[invalid=true]:bg-red-500/[0.04]'

/** Password field with a show/hide toggle at its end. */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  const t = useT()
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn('pe-12', invalidClass, className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={visible}
        aria-controls={props.id}
        disabled={props.disabled}
        className="absolute inset-y-0 end-0 grid w-12 place-items-center rounded-e-xl text-white/45 outline-none transition-colors duration-150 hover:text-white focus-visible:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500 disabled:opacity-40"
      >
        {visible ? <EyeOff aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <Eye aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'

/** Email field: the keyboard, autofill and direction an address needs. */
export const EmailInput = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <Input
    ref={ref}
    type="email"
    inputMode="email"
    autoComplete="email"
    autoCapitalize="none"
    autoCorrect="off"
    spellCheck={false}
    dir="ltr"
    className={cn('rtl:text-right', invalidClass, className)}
    {...props}
  />
))
EmailInput.displayName = 'EmailInput'

/**
 * A button that swaps its label for a spinner while busy. Both states share one grid cell, so the
 * button never changes size; the swap is a short cross-fade with a touch of blur.
 */
export function LoadingButton({ loading = false, loadingText, children, className, disabled, ...props }: ButtonProps & {
  loading?: boolean
  loadingText?: React.ReactNode
}) {
  return (
    <Button
      size="lg"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('grid', loading && 'disabled:opacity-100', className)}
      {...props}
    >
      <span className={cn('col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-[opacity,filter] duration-200 ease-out', loading && 'opacity-0 blur-[2px]')}>
        {children}
      </span>
      <span aria-hidden={!loading} className={cn('col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-[opacity,filter] duration-200 ease-out', !loading && 'opacity-0 blur-[2px]')}>
        <Loader2 aria-hidden className="h-[18px] w-[18px] animate-spin" />
        {loadingText}
      </span>
    </Button>
  )
}

export function SubmitButton(props: React.ComponentProps<typeof LoadingButton>) {
  return <LoadingButton type="submit" {...props} />
}

/** A message for the whole form (server error, or a friendly note). Slides open, slides shut. */
export function FormNotice({ message, tone = 'error', className }: { message?: string | null, tone?: 'error' | 'info', className?: string }) {
  const Icon = tone === 'error' ? AlertCircle : Info
  return (
    <AnimatePresence initial={false}>
      {message && (
        <m.div
          key="notice"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0, transition: tween.fast }}
          transition={tween.base}
          className="overflow-hidden"
        >
          <div className={className}>
            <div
              role={tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'flex items-start gap-3 rounded-2xl px-4 py-3 text-[14px] leading-snug ring-1 ring-inset',
                tone === 'error' ? 'bg-red-500/[0.09] text-red-50 ring-red-500/25' : 'bg-white/[0.06] text-white/85 ring-white/10',
              )}
            >
              <Icon aria-hidden className={cn('mt-px h-[18px] w-[18px] shrink-0', tone === 'error' ? 'text-red-400' : 'text-white/70')} strokeWidth={2} />
              <p>{message}</p>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

/** "Done": a soft disc that settles in while the check draws itself, and one ring of light. */
export function SuccessCheck({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative grid h-16 w-16 place-items-center', className)}>
      <m.span
        className="absolute inset-0 rounded-full ring-1 ring-white/30"
        initial={{ scale: 0.9, opacity: 0.7 }}
        animate={{ scale: 1.7, opacity: 0 }}
        transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.3 }}
      />
      <m.span
        className="absolute inset-0 rounded-full bg-white/[0.09] shadow-[0_0_48px_-8px_rgb(255_255_255/0.35)] ring-1 ring-inset ring-white/15"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.3, duration: 0.55 }}
      />
      <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <m.path
          d="M5 12.5l4.5 4.5L19 7.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ pathLength: { duration: 0.42, ease: EASE_OUT, delay: 0.18 }, opacity: { duration: 0.01, delay: 0.18 } }}
        />
      </svg>
    </div>
  )
}

/** A quiet round badge for a state icon (invalid link, error...). */
export function StateIcon({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span aria-hidden className={cn('grid h-16 w-16 place-items-center rounded-full bg-white/[0.07] text-white/80 ring-1 ring-inset ring-white/10', className)}>
      {children}
    </span>
  )
}
