import ClientMessages from '@/src/components/ClientMessages'

/** The strings this segment's client components translate, beyond every page's (see ClientMessages). */
export default function ULayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages scope="u/layout">{children}</ClientMessages>
}
