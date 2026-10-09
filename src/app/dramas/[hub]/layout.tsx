import { notFound } from 'next/navigation'
import { HUB_IDS, isHubId } from '@/src/lib/dramas-config'

// Only the known hubs exist: anything else (/dramas/japanese) is a real 404, answered by the router
// before the page (and its loading screen) start streaming with a 200.
export const dynamicParams = false
export const generateStaticParams = () => HUB_IDS.map((hub) => ({ hub }))

export default function DramaHubLayout({ children, params }: { children: React.ReactNode, params: { hub: string } }) {
  if (!isHubId(params.hub)) notFound()
  return <>{children}</>
}
