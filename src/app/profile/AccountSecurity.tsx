"use client"
import React, { useId, useState } from 'react'
import { signOut } from 'next-auth/react'
import { Download, KeyRound, Trash2 } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import SettingsSection from '@/src/components/profile/SettingsSection'
import { useT } from '@/src/components/I18nProvider'
import { useAccount } from '@/src/hooks/use-account'
import { toast } from '@/src/hooks/use-toast'
import { translateApiMessage } from '@/src/lib/i18n'

// 16px on phones: smaller text makes iOS zoom into the field.
const input = 'text-base sm:text-[15px]'
const label = 'text-[13px] font-medium text-white/70'
const inner = 'rounded-[20px] bg-white/[0.03] p-5 ring-1 ring-inset'

/** Settings > Security (#security: password) and Your data (#data: export, delete account). */
export default function AccountSecurity() {
  const t = useT()
  const id = useId()
  const { account, refresh } = useAccount()

  // --- password ---
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordError(null)
    if (newPassword.length < 8) return setPasswordError(t('auth.passwordTooShort'))
    if (newPassword !== confirmPassword) return setPasswordError(t('auth.passwordMismatch'))
    setSavingPassword(true)
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setPasswordError(data.error === 'wrongPassword' ? t('account.wrongPassword') : translateApiMessage(t, data.message) ?? t('auth.genericError'))
        return
      }
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      toast({ title: t(account?.hasPassword ? 'account.passwordChanged' : 'account.passwordSet') })
      refresh()
    } catch {
      setPasswordError(t('auth.genericError'))
    } finally {
      setSavingPassword(false)
    }
  }

  // --- delete ---
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account?.hasPassword ? { password: confirmation } : { email: confirmation }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setDeleteError(data.error === 'notConfirmed'
          ? t(account?.hasPassword ? 'account.wrongPassword' : 'account.emailMismatch')
          : translateApiMessage(t, data.message) ?? t('auth.genericError'))
        setDeleting(false)
        return
      }
      toast({ title: t('account.deleted') })
      await signOut({ callbackUrl: '/' })
    } catch {
      setDeleteError(t('auth.genericError'))
      setDeleting(false)
    }
  }

  // Loading: keep both sections (and their anchors) in place.
  if (!account) {
    return (
      <>
        <SettingsSection id="security" title={t('settings.security')} description={t('settings.securityDesc')}>
          <div aria-busy className="max-w-md space-y-4">
            <Skeleton className="h-11 rounded-xl" /><Skeleton className="h-11 rounded-xl" /><Skeleton className="h-10 w-36 rounded-full" />
          </div>
        </SettingsSection>
        <SettingsSection id="data" title={t('settings.data')} description={t('settings.dataDesc')}>
          <div aria-busy className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40 rounded-[20px]" /><Skeleton className="h-40 rounded-[20px]" />
          </div>
        </SettingsSection>
      </>
    )
  }

  return (
    <>
      <SettingsSection id="security" title={t('settings.security')} description={t('settings.securityDesc')}>
        <form onSubmit={savePassword} className="max-w-md space-y-5">
          <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-white">
            <KeyRound aria-hidden className="h-[18px] w-[18px] text-white/70" />
            {t(account.hasPassword ? 'account.changePassword' : 'account.setPassword')}
          </h3>
          {!account.hasPassword && <p className="-mt-2 text-[14px] leading-relaxed text-white/55">{t('account.setPasswordDesc')}</p>}
          {account.hasPassword && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-current`} className={label}>{t('account.currentPassword')}</Label>
              <Input id={`${id}-current`} type="password" autoComplete="current-password" className={input} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${id}-new`} className={label}>{t('auth.newPassword')}</Label>
            <Input id={`${id}-new`} type="password" autoComplete="new-password" className={input} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-confirm`} className={label}>{t('auth.confirmPassword')}</Label>
            <Input id={`${id}-confirm`} type="password" autoComplete="new-password" className={input} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} aria-describedby={passwordError ? `${id}-password-error` : undefined} />
            {passwordError && <p id={`${id}-password-error`} className="text-[13px] text-red-400" role="alert">{passwordError}</p>}
          </div>
          <Button type="submit" disabled={savingPassword} className="max-sm:w-full">
            {savingPassword ? t('form.sending') : t('account.savePassword')}
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection id="data" title={t('settings.data')} description={t('settings.dataDesc')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={`${inner} flex flex-col ring-white/[0.05]`}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.07]"><Download aria-hidden className="h-5 w-5 text-white/85" /></span>
            <h3 className="mt-4 text-[15px] font-semibold text-white">{t('account.exportTitle')}</h3>
            <p className="mt-1 flex-1 text-[13.5px] leading-relaxed text-white/55">{t('account.exportDesc')}</p>
            {/* A plain link: the browser saves the JSON file (Content-Disposition: attachment). */}
            <Button asChild variant="secondary" className="mt-5 self-start">
              <a href="/api/account/export"><Download aria-hidden className="h-4 w-4" /> {t('account.exportButton')}</a>
            </Button>
          </div>

          <div className={`${inner} flex flex-col ring-red-500/20`}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-red-600/15"><Trash2 aria-hidden className="h-5 w-5 text-red-400" /></span>
            <h3 className="mt-4 text-[15px] font-semibold text-red-300">{t('account.deleteTitle')}</h3>
            <p className="mt-1 flex-1 text-[13.5px] leading-relaxed text-white/55">{t('account.deleteDesc')}</p>
            <Button type="button" variant="destructive" className="mt-5 self-start" onClick={() => { setConfirmation(''); setDeleteError(null); setDeleteOpen(true) }}>
              {t('account.deleteButton')}
            </Button>
          </div>
        </div>
      </SettingsSection>

      <Dialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span aria-hidden className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-red-600/15 text-red-400 max-sm:mx-auto">
              <Trash2 className="h-5 w-5" />
            </span>
            <DialogTitle className="font-display text-2xl font-bold">{t('account.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('account.deleteConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${id}-confirmation`} className={label}>
              {t(account.hasPassword ? 'account.confirmWithPassword' : 'account.confirmWithEmail', { email: account.email ?? '' })}
            </Label>
            <Input
              id={`${id}-confirmation`}
              type={account.hasPassword ? 'password' : 'email'}
              dir="ltr"
              className={input}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete={account.hasPassword ? 'current-password' : 'off'}
              aria-describedby={deleteError ? `${id}-delete-error` : undefined}
            />
            {deleteError && <p id={`${id}-delete-error`} className="text-[13px] text-red-400" role="alert">{deleteError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" disabled={deleting} onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" variant="destructive" disabled={deleting || !confirmation} onClick={deleteAccount}>
              <Trash2 aria-hidden className="h-4 w-4" />
              {deleting ? t('account.deleting') : t('account.deleteForever')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
