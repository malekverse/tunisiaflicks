import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { JsonLd, movieJsonLd } from '@/src/lib/structured-data'
import ClientMessages from '@/src/components/ClientMessages'

// Adds schema.org structured data to the page (rich results in search). A failed lookup just
// renders the page without it; the page itself handles not-found. Also the strings the page's client
// components translate (see ClientMessages).
export default async function Layout({ children, params }: { children: React.ReactNode, params: { id: string } }) {
  const data = /^\d+$/.test(params.id) ? await tmdbFetchSafe(`movie/${params.id}`, { append_to_response: 'credits' }, 86400) : null
  return (
    <ClientMessages scope="movie/[id]/layout">
      {data && <JsonLd data={movieJsonLd(data)} />}
      {children}
    </ClientMessages>
  )
}
