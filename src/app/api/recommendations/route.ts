// Personalised "Because you watched X" rows for the signed-in user's active profile.
//
// Seeds are the user's most recent history (then favorites); for each seed we take TMDB's own
// recommendations, drop anything the user already watched / favorited / saved, and avoid repeating
// a title across rows. No ML, no extra storage: just the lists we already keep + TMDB.
import { NextResponse } from 'next/server'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { filterKidSafe } from '@/src/lib/kids'
import { requireActiveProfile } from '@/src/lib/profiles'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 2
const MAX_SEEDS = 4 // try a few seeds in case some have no usable recommendations
const MIN_ITEMS = 6
const ROW_SIZE = 20

type Seed = { id: string, title: string, media_type: 'movie' | 'tv' }

const keyOf = (type: string, id: string | number) => `${type}-${id}`

export async function GET() {
  try {
    const owner = await requireActiveProfile()
    if ('error' in owner) return owner.error
    const { userId, profile } = owner

    const client = await clientPromise
    const lists = await client.db().collection('userContent')
      .find({ userId, profileId: profile.id, type: { $in: ['history', 'favorites', 'saved'] } })
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
      seeds.map(async (seed) => {
        const data = await tmdbFetchSafe<{ results: any[] }>(`${seed.media_type}/${seed.id}/recommendations`, { page: 1 }, 86400)
        // Kids profiles only get titles rated for them.
        return data && profile.kids ? { results: await filterKidSafe(data.results ?? [], seed.media_type) } : data
      })
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
