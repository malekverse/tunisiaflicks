import Link from 'next/link'
import { formatHours, type WrappedStats } from '@/src/lib/wrapped'

const poster = (path: string | null | undefined, size = 'w342') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : '/404.png')

const card = 'relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-black/30'

function Big({ children }: { children: React.ReactNode }) {
  return <p className="text-6xl sm:text-7xl font-black leading-none tracking-tight">{children}</p>
}

/** The recap itself. Pure markup (no client state), shared by /wrapped and public share pages. */
export default function WrappedCards({ stats, isCurrentYear }: { stats: WrappedStats, isCurrentYear: boolean }) {
  const hours = stats.minutes / 60
  const topGenreMinutes = stats.topGenres[0]?.minutes || 1

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {/* Intro */}
      <section className={`${card} md:col-span-2 xl:col-span-3 bg-gradient-to-br from-red-600 via-red-700 to-zinc-950 min-h-[220px] flex flex-col justify-end`}>
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-100/80">TunisiaFlicks Wrapped</p>
        <h1 className="mt-3 text-4xl sm:text-6xl font-black leading-tight">
          {stats.name}&apos;s {stats.year}{isCurrentYear ? ' so far' : ''}
        </h1>
        <p className="mt-2 text-lg text-red-50/90">Here&apos;s what kept you watching.</p>
      </section>

      {/* Titles */}
      <section className={`${card} bg-gradient-to-br from-zinc-800 to-zinc-950`}>
        <p className="text-sm font-semibold text-gray-300">You watched</p>
        <Big>{stats.titles}</Big>
        <p className="mt-2 text-xl font-semibold">title{stats.titles === 1 ? '' : 's'}</p>
        <p className="mt-4 text-gray-400">{stats.movies} movie{stats.movies === 1 ? '' : 's'} · {stats.shows} show{stats.shows === 1 ? '' : 's'}</p>
      </section>

      {/* Time */}
      <section className={`${card} bg-gradient-to-br from-orange-500 via-red-600 to-rose-900`}>
        <p className="text-sm font-semibold text-orange-100">Time spent watching</p>
        <Big>~{formatHours(stats.minutes)}</Big>
        <p className="mt-2 text-xl font-semibold">hours</p>
        <p className="mt-4 text-orange-50/90">
          {hours >= 24
            ? `That's about ${Math.round(hours / 24)} full day${Math.round(hours / 24) === 1 ? '' : 's'} of non-stop watching.`
            : stats.episodes > 0 ? `Including about ${stats.episodes} episode${stats.episodes === 1 ? '' : 's'}.` : 'Every minute well spent.'}
        </p>
        <p className="mt-3 text-xs text-orange-100/60">Estimated from your watch history.</p>
      </section>

      {/* Personality */}
      <section className={`${card} bg-gradient-to-br from-fuchsia-600 via-purple-700 to-indigo-950`}>
        <p className="text-sm font-semibold text-fuchsia-100">Your viewer personality</p>
        <p className="mt-3 text-4xl font-black leading-tight">{stats.personality.title}</p>
        <p className="mt-4 text-fuchsia-50/90">{stats.personality.blurb}</p>
      </section>

      {/* Genres */}
      {stats.topGenres.length > 0 && (
        <section className={`${card} bg-gradient-to-br from-emerald-600 via-teal-700 to-zinc-950`}>
          <p className="text-sm font-semibold text-emerald-100">Your top genres</p>
          <ol className="mt-4 space-y-4">
            {stats.topGenres.map((genre, index) => (
              <li key={genre.name}>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-black text-emerald-200">#{index + 1}</span>
                  <span className={index === 0 ? 'text-3xl font-black' : 'text-xl font-bold'}>{genre.name}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-black/30">
                  <div className="h-2 rounded-full bg-emerald-200" style={{ width: `${Math.max(8, (genre.minutes / topGenreMinutes) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Top show */}
      {stats.topShow && (
        <Link href={`/tv/${stats.topShow.id}`} className={`${card} bg-gradient-to-br from-sky-600 via-blue-800 to-zinc-950 flex gap-5 items-center hover:brightness-110 transition`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster(stats.topShow.poster_path)} alt={stats.topShow.title} className="w-28 sm:w-32 aspect-[2/3] rounded-xl object-cover shadow-lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sky-100">Your most-watched show</p>
            <p className="mt-2 text-2xl sm:text-3xl font-black leading-tight">{stats.topShow.title}</p>
            <p className="mt-2 text-sky-50/90">~{stats.topShow.episodes} episode{stats.topShow.episodes === 1 ? '' : 's'}</p>
          </div>
        </Link>
      )}

      {/* Top movie */}
      {stats.topMovie && (
        <Link href={`/movie/${stats.topMovie.id}`} className={`${card} bg-gradient-to-br from-amber-500 via-orange-700 to-zinc-950 flex gap-5 items-center hover:brightness-110 transition`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster(stats.topMovie.poster_path)} alt={stats.topMovie.title} className="w-28 sm:w-32 aspect-[2/3] rounded-xl object-cover shadow-lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-100">Your highest-rated pick</p>
            <p className="mt-2 text-2xl sm:text-3xl font-black leading-tight">{stats.topMovie.title}</p>
            <p className="mt-2 text-amber-50/90">★ {stats.topMovie.rating} on TMDB</p>
          </div>
        </Link>
      )}

      {/* First watch */}
      {stats.firstWatch && (
        <Link href={`/${stats.firstWatch.media_type}/${stats.firstWatch.id}`} className={`${card} bg-gradient-to-br from-zinc-700 to-zinc-950 flex gap-5 items-center hover:brightness-110 transition`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster(stats.firstWatch.poster_path)} alt={stats.firstWatch.title} className="w-24 aspect-[2/3] rounded-xl object-cover shadow-lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-300">Your {stats.year} started with</p>
            <p className="mt-2 text-2xl font-black leading-tight">{stats.firstWatch.title}</p>
            <p className="mt-2 text-gray-400">{new Date(stats.firstWatch.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</p>
          </div>
        </Link>
      )}

      {/* Favorites */}
      {stats.favorites > 0 && (
        <section className={`${card} bg-gradient-to-br from-pink-500 via-rose-700 to-zinc-950`}>
          <p className="text-sm font-semibold text-pink-100">You fell in love with</p>
          <Big>{stats.favorites}</Big>
          <p className="mt-2 text-xl font-semibold">new favorite{stats.favorites === 1 ? '' : 's'}</p>
        </section>
      )}

      {/* Collage */}
      {stats.posters.length > 0 && (
        <section className={`${card} md:col-span-2 xl:col-span-3 bg-zinc-900 border border-zinc-800`}>
          <p className="text-sm font-semibold text-gray-300 mb-4">Your {stats.year} in posters</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
            {stats.posters.map((path) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={path} src={poster(path, 'w185')} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
