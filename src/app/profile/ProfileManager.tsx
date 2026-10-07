"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FaLock, FaTrash } from 'react-icons/fa'
import ProfileAvatar, { KidsBadge } from '@/src/components/profiles/ProfileAvatar'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { toast } from '@/src/hooks/use-toast'
import { useProfiles } from '@/src/hooks/use-profiles'
import { MAX_PROFILES, MAX_PROFILE_NAME, PROFILE_COLORS, type Profile } from '@/src/lib/models/Profile'

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error ?? 'Something went wrong')
  }
  return response.json()
}

function ColorPicker({ value, onChange }: { value: string, onChange: (color: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Avatar colour" className="flex flex-wrap gap-2">
      {PROFILE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={`Colour ${color}`}
          onClick={() => onChange(color)}
          className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-gray-900 ${value === color ? 'ring-2 ring-black dark:ring-white' : ''}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

function KidsToggle({ checked, onChange, disabled }: { checked: boolean, onChange: (kids: boolean) => void, disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-red-500' : 'bg-gray-500'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
      <span>
        Kids profile
        <span className="block text-xs text-gray-400">Only G / PG movies and kids&apos; TV, and a password to switch away.</span>
      </span>
    </label>
  )
}

function ProfileCard({ profile, isActive, isOwner, onlyGrownUp, onChanged, onDelete }: {
  profile: Profile
  isActive: boolean
  isOwner: boolean
  onlyGrownUp: boolean
  onChanged: (kidsChangedOnActive: boolean) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(profile.name)
  const [saving, setSaving] = useState(false)
  useEffect(() => setName(profile.name), [profile.name])

  const update = async (patch: Partial<Profile>) => {
    setSaving(true)
    try {
      await send(`/api/profiles/${profile.id}`, 'PATCH', patch)
      onChanged(isActive && patch.kids !== undefined)
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' })
      setName(profile.name)
    } finally {
      setSaving(false)
    }
  }

  const renamed = name.trim() !== profile.name

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-4">
        <ProfileAvatar profile={{ name: name || profile.name, color: profile.color }} size="md" className="h-14 w-14 text-2xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (renamed) update({ name })
            }}
          >
            <Input aria-label={`Name of ${profile.name}`} value={name} maxLength={MAX_PROFILE_NAME} onChange={(event) => setName(event.target.value)} />
            {renamed && <Button type="submit" disabled={saving} className="bg-red-600 text-white hover:bg-red-700">Save</Button>}
          </form>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
            {isActive && <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 font-semibold text-red-500">Watching now</span>}
            {isOwner && <span>Account owner</span>}
            {profile.kids && <KidsBadge />}
          </div>
          <ColorPicker value={profile.color} onChange={(color) => color !== profile.color && update({ color })} />
          <KidsToggle
            checked={profile.kids}
            disabled={saving || (!profile.kids && onlyGrownUp)}
            onChange={(kids) => update({ kids })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${profile.name}`}
          title={onlyGrownUp && !profile.kids ? 'Keep at least one grown-up profile' : `Delete ${profile.name}`}
          disabled={onlyGrownUp && !profile.kids}
          onClick={onDelete}
          className="text-gray-400 hover:bg-red-500/10 hover:text-red-500"
        >
          <FaTrash />
        </Button>
      </div>
    </li>
  )
}

/** Create, rename, recolour, Kids toggle and delete profiles (grown-up profiles only). */
export default function ProfileManager() {
  const { data, active, reload } = useProfiles()
  const [deleting, setDeleting] = useState<Profile | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(PROFILE_COLORS[1])
  const [newKids, setNewKids] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!data) return null
  const profiles = data.profiles
  const grownUps = profiles.filter((profile) => !profile.kids).length

  const header = (
    <div className="mb-4">
      <h2 className="text-2xl font-bold">Profiles</h2>
      <p className="text-sm text-gray-400">
        Up to {MAX_PROFILES} people can share this account. Each profile has its own favorites, bookmarks, watch history and recommendations.
      </p>
    </div>
  )

  if (!active || active.kids) {
    return (
      <section id="profiles" className="mt-10 scroll-mt-24">
        {header}
        <div className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center">
          <FaLock className="text-2xl text-gray-400" />
          <p className="flex-1 text-sm">Switch to a grown-up profile to add, edit or delete profiles.</p>
          <Link href="/profiles"><Button className="bg-red-600 text-white hover:bg-red-700">Switch profile</Button></Link>
        </div>
      </section>
    )
  }

  const changed = (kidsChangedOnActive: boolean) => {
    // The catalogue follows the active profile's Kids setting: reload everything.
    if (kidsChangedOnActive) window.location.reload()
    else reload()
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await send('/api/profiles', 'POST', { name: newName, color: newColor, kids: newKids })
      toast({ title: 'Profile added', description: `${newName.trim()} can now pick their profile on "Who's watching?"` })
      setNewName('')
      setNewKids(false)
      setNewColor(PROFILE_COLORS[(profiles.length + 2) % PROFILE_COLORS.length])
      reload()
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await send(`/api/profiles/${deleting.id}`, 'DELETE')
      toast({ title: 'Profile deleted', description: `${deleting.name} and their lists were removed` })
      if (deleting.id === active.id) return window.location.assign('/profiles')
      setDeleting(null)
      reload()
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="profiles" className="mt-10 scroll-mt-24">
      {header}
      <ul className="grid gap-4 md:grid-cols-2">
        {profiles.map((profile, index) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            isActive={profile.id === active.id}
            isOwner={index === 0}
            onlyGrownUp={!profile.kids && grownUps <= 1}
            onChanged={changed}
            onDelete={() => setDeleting(profile)}
          />
        ))}

        {profiles.length < MAX_PROFILES && (
          <li className="rounded-xl border-2 border-dashed border-gray-300 p-4 dark:border-gray-700">
            <form onSubmit={create} className="space-y-3">
              <h3 className="font-semibold">Add a profile</h3>
              <div className="flex items-center gap-4">
                <ProfileAvatar profile={{ name: newName.trim() || '+', color: newColor }} size="md" className="h-14 w-14 text-2xl" />
                <Input aria-label="New profile name" placeholder="Name" value={newName} maxLength={MAX_PROFILE_NAME} onChange={(event) => setNewName(event.target.value)} />
              </div>
              <ColorPicker value={newColor} onChange={setNewColor} />
              <KidsToggle checked={newKids} onChange={setNewKids} />
              <Button type="submit" disabled={busy || !newName.trim()} className="w-full bg-red-600 text-white hover:bg-red-700">
                Add profile
              </Button>
            </form>
          </li>
        )}
      </ul>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm bg-black border border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription className="text-white/70">
              Their favorites, bookmarks, watch history and Continue Watching will be removed for good.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={confirmDelete}>Delete profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
