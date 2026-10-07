"use client"
import React, { useState } from 'react'
import { signOut } from 'next-auth/react'
import { FaDownload, FaLock, FaTrash } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { useT } from '@/src/components/I18nProvider'
import { useAccount } from '@/src/hooks/use-account'
import { toast } from '@/src/hooks/use-toast'
import { translateApiMessage } from '@/src/lib/i18n'

const input = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-zinc-700 dark:bg-[#1a161f] dark:text-white'
const card = 'rounded-2xl border border-gray-200 p-5 dark:border-zinc-800'

/** Password, data export and account deletion. */
export default function AccountSecurity() {
  const t = useT()
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

  if (!account) return null

  return (
    <section id="account" className="mt-10 scroll-mt-24">
      <h2 className="mb-4 text-2xl font-bold">{t('account.title')}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={savePassword} className={`${card} space-y-3`}>
          <h3 className="flex items-center gap-2 font-semibold"><FaLock className="text-red-500" />{t(account.hasPassword ? 'account.changePassword' : 'account.setPassword')}</h3>
          {!account.hasPassword && <p className="text-sm text-gray-500">{t('account.setPasswordDesc')}</p>}
          {account.hasPassword && (
            <label className="block text-sm">
              {t('account.currentPassword')}
              <input type="password" autoComplete="current-password" className={`mt-1 ${input}`} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </label>
          )}
          <label className="block text-sm">
            {t('auth.newPassword')}
            <input type="password" autoComplete="new-password" className={`mt-1 ${input}`} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          </label>
          <label className="block text-sm">
            {t('auth.confirmPassword')}
            <input type="password" autoComplete="new-password" className={`mt-1 ${input}`} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
          </label>
          {passwordError && <p className="text-sm text-red-500" role="alert">{passwordError}</p>}
          <Button type="submit" disabled={savingPassword} className="bg-red-500 text-white hover:bg-red-400">
            {savingPassword ? t('form.sending') : t('account.savePassword')}
          </Button>
        </form>

        <div className="space-y-4">
          <div className={card}>
            <h3 className="flex items-center gap-2 font-semibold"><FaDownload className="text-red-500" />{t('account.exportTitle')}</h3>
            <p className="mt-2 text-sm text-gray-500">{t('account.exportDesc')}</p>
            {/* A plain link: the browser saves the JSON file (Content-Disposition: attachment). */}
            <a href="/api/account/export" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
              <FaDownload /> {t('account.exportButton')}
            </a>
          </div>

          <div className={`${card} border-red-500/40 dark:border-red-500/40`}>
            <h3 className="flex items-center gap-2 font-semibold text-red-500"><FaTrash />{t('account.deleteTitle')}</h3>
            <p className="mt-2 text-sm text-gray-500">{t('account.deleteDesc')}</p>
            <Button type="button" variant="destructive" className="mt-3" onClick={() => { setConfirmation(''); setDeleteError(null); setDeleteOpen(true) }}>
              {t('account.deleteButton')}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('account.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('account.deleteConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <label className="block text-sm">
            {t(account.hasPassword ? 'account.confirmWithPassword' : 'account.confirmWithEmail', { email: account.email ?? '' })}
            <input
              type={account.hasPassword ? 'password' : 'email'}
              dir="ltr"
              className={`mt-1 ${input}`}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete={account.hasPassword ? 'current-password' : 'off'}
            />
          </label>
          {deleteError && <p className="text-sm text-red-500" role="alert">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" variant="destructive" disabled={deleting || !confirmation} onClick={deleteAccount}>
              {deleting ? t('account.deleting') : t('account.deleteForever')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
