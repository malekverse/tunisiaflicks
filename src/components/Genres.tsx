import Link from 'next/link';
import HorizontalScroller from './custom/HorizontalScroller';
import { Button } from './ui/button';
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb';
import { getLocale } from '@/src/lib/i18n/server';

// Server component: the genre list is fetched on the server (cached for a day), so the TMDB key
// never reaches the browser and the bar renders with the page instead of popping in later.
export default async function Genres({ type }: { type?: 'tv' | 'movie' }) {
    const data = await tmdbFetchSafe<{ genres: { id: number, name: string }[] }>(
        `genre/${type === 'tv' ? 'tv' : 'movie'}/list`, { language: tmdbLanguage(getLocale()) }, 86400
    );
    const genres = data?.genres ?? [];
    if (genres.length === 0) return null;

    return (
        // genres bar
        <div className='max-w-full grid'>
            <HorizontalScroller>
                {genres.map((genre) => (
                    <Link href={`/genres/${genre.id}${type === 'tv' ? '?type=tv' : ''}`} key={genre.id}>
                        <Button className="px-4 py-2 bg-zinc-800 text-white hover:bg-zinc-500 rounded-xl">
                            {genre.name}
                        </Button>
                    </Link>
                ))}
            </HorizontalScroller>
        </div>
    )
}
