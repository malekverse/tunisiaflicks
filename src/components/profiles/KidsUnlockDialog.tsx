"use client"
import { useEffect, useId, useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import ProfileAvatar from './ProfileAvatar'
import { selectProfile } from '@/src/hooks/use-profiles'
import { useT } from '@/src/components/I18nProvider'
import type { Profile } from '@/src/lib/models/Profile'

/**
 * The grown-up check for leaving a Kids profile: the account password, verified by the server
 * (POST /api/profiles/active), then `onUnlocked` (usually a reload into the new profile).
 */
export default function KidsUnlockDialog({ profile, onClose, onUnlocked }: {
  profile: Profile | null
  onClose: () => void
  onUnlocked: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const t = useT()
  const id = useId()

  useEffect(() => {
    setPassword('')
    setError(null)
  }, [profile])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile || !password) return
    setBusy(true)
    const result = await selectProfile(profile.id, password)
    setBusy(false)
    if (result.ok) onUnlocked()
    else setError(result.needsPassword ? t('profiles.wrongPassword') : t('profiles.switchFailed'))
  }

  return (
    <Dialog open={profile !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center sm:items-start sm:text-start">
          <span className="relative mb-3">
            {profile && <ProfileAvatar profile={profile} size="md" className="h-14 w-14 rounded-2xl text-2xl" />}
            <span className="glass absolute -bottom-1.5 -end-1.5 grid h-7 w-7 place-items-center rounded-full text-white">
              <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
          </span>
          <DialogTitle className="font-display text-2xl font-bold">{t('profiles.grownUpsOnly')}</DialogTitle>
          <DialogDescription>{t('profiles.enterPassword', { name: profile?.name ?? '' })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={`${id}-password`} className="text-[13px] font-medium text-white/70">{t('profiles.accountPassword')}</Label>
            <Input
              id={`${id}-password`}
              type="password"
              autoFocus
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(null) }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="text-base sm:text-[15px]"
            />
            {error && <p id={`${id}-error`} role="alert" className="text-[13px] text-red-400">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t('profiles.cancel')}</Button>
            <Button type="submit" disabled={busy || !password}>
              {busy ? t('profiles.checking') : t('profiles.switchProfile')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
