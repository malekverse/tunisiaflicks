import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { JsonLd, personJsonLd } from '@/src/lib/structured-data'
import ClientMessages from '@/src/components/ClientMessages'

// Adds schema.org structured data to the page (rich results in search). A failed lookup just
// renders the page without it; the page itself handles not-found. Also the strings the page's client
// components translate (see ClientMessages).
export default async function Layout({ children, params }: { children: React.ReactNode, params: { id: string } }) {
  const data = /^\d+$/.test(params.id) ? await tmdbFetchSafe(`person/${params.id}`, {}, 86400) : null
  return (
    <ClientMessages scope="person/[id]/layout">
      {data && <JsonLd data={personJsonLd(data)} />}
      {children}
    </ClientMessages>
  )
}
