"use client"
import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { selectProfile } from '@/src/hooks/use-profiles'
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
    else setError(result.error)
  }

  return (
    <Dialog open={profile !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-black border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <Lock className="h-5 w-5" /> Grown-ups only
          </DialogTitle>
          <DialogDescription className="text-white/70">
            Enter the account password to switch to {profile?.name ?? 'this profile'}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            aria-label="Account password"
            placeholder="Account password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="bg-black border-gray-600 text-white placeholder:text-white/50 focus:border-red-600 focus:ring-red-600"
          />
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !password} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? 'Checking…' : 'Switch profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
