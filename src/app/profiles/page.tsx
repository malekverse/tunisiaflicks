// "Who's watching?": shown after signing in, and whenever this device has no usable profile picked.
import { redirect } from 'next/navigation'
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { getActiveProfile, toProfilesResponse } from '@/src/lib/profiles'
import { getT } from '@/src/lib/i18n/server'
import ProfilePicker from './ProfilePicker'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => ({ title: `${getT()('profiles.whoIsWatching')} | TunisiaFlicks` })

export default async function ProfilesPage({ searchParams }: { searchParams: { next?: string } }) {
  const active = await getActiveProfile()
  if (!active) redirect('/login')

  // The owner's profile (the first) shows the account photo, as the navbar does.
  const client = await clientPromise
  const user = await client.db().collection('users').findOne({ _id: new ObjectId(active.userId) }, { projection: { image: 1 } })

  return <ProfilePicker initial={toProfilesResponse(active)} ownerImage={user?.image ?? null} next={searchParams.next} />
}
