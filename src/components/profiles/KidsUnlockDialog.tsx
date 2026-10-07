"use client"
import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
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
      <DialogContent className="max-w-sm bg-black border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <Lock className="h-5 w-5" /> {t('profiles.grownUpsOnly')}
          </DialogTitle>
          <DialogDescription className="text-white/70">
            {t('profiles.enterPassword', { name: profile?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            aria-label={t('profiles.accountPassword')}
            placeholder={t('profiles.accountPassword')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="bg-black border-gray-600 text-white placeholder:text-white/50 focus:border-red-600 focus:ring-red-600"
          />
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t('profiles.cancel')}</Button>
            <Button type="submit" disabled={busy || !password} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? t('profiles.checking') : t('profiles.switchProfile')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
