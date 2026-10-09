import ClientMessages from '@/src/components/ClientMessages'

/** The strings this segment's client components translate, beyond every page's (see ClientMessages). */
export default function TvLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages scope="tv/layout">{children}</ClientMessages>
}
