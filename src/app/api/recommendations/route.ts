// Personalised "Because you watched X" rows for the signed-in user.
//
// Seeds are the user's most recent history (then favorites); for each seed we take TMDB's own
// recommendations, drop anything the user already watched / favorited / saved, and avoid repeating
// a title across rows. No ML, no extra storage: just the lists we already keep + TMDB.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 2
const MAX_SEEDS = 4 // try a few seeds in case some have no usable recommendations
const MIN_ITEMS = 6
const ROW_SIZE = 20

type Seed = { id: string, title: string, media_type: 'movie' | 'tv' }

const keyOf = (type: string, id: string | number) => `${type}-${id}`

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await clientPromise
    const lists = await client.db().collection('userContent')
      .find({ userId, type: { $in: ['history', 'favorites', 'saved'] } })
      .toArray()
    const listOf = (type: string): any[] => lists.find((list) => list.type === type)?.items ?? []

    // Everything the user already has, so we never recommend it back.
    const known = new Set<string>()
    for (const type of ['history', 'favorites', 'saved']) {
      for (const item of listOf(type)) known.add(keyOf(item.media_type, item.id))
    }

    // Most recent history first, then favorites; one seed per title.
    const seeds: Seed[] = []
    const seenSeeds = new Set<string>()
    for (const item of [...listOf('history'), ...listOf('favorites')]) {
      const key = keyOf(item.media_type, item.id)
      if (seenSeeds.has(key) || (item.media_type !== 'movie' && item.media_type !== 'tv')) continue
      seenSeeds.add(key)
      seeds.push({ id: String(item.id), title: item.title, media_type: item.media_type })
      if (seeds.length >= MAX_SEEDS) break
    }

    const recommendations = await Promise.all(
      seeds.map((seed) => tmdbFetchSafe<{ results: any[] }>(`${seed.media_type}/${seed.id}/recommendations`, { page: 1 }, 86400))
    )

    const used = new Set<string>()
    const rows: { seed: Seed, items: any[] }[] = []
    seeds.forEach((seed, index) => {
      if (rows.length >= MAX_ROWS) return
      const items = (recommendations[index]?.results ?? [])
        .map((item) => ({ ...item, media_type: item.media_type ?? seed.media_type }))
        .filter((item) => item.poster_path && !item.adult)
        .filter((item) => {
          const key = keyOf(item.media_type, item.id)
          return !known.has(key) && !used.has(key)
        })
        .slice(0, ROW_SIZE)
      if (items.length < MIN_ITEMS) return
      items.forEach((item) => used.add(keyOf(item.media_type, item.id)))
      rows.push({
        seed,
        // Only what the cards need.
        items: items.map(({ id, title, name, poster_path, vote_average, release_date, first_air_date, media_type }) => (
          { id, title, name, poster_path, vote_average, release_date, first_air_date, media_type }
        )),
      })
    })

    return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Error building recommendations:', error)
    return NextResponse.json({ error: 'Failed to build recommendations' }, { status: 500 })
  }
}
