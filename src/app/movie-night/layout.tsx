import ClientMessages from '@/src/components/ClientMessages'

/** The strings this segment's client components translate, beyond every page's (see ClientMessages). */
export default function MovieNightLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages scope="movie-night/layout">{children}</ClientMessages>
}
