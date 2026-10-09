import ClientMessages from '@/src/components/ClientMessages'

/** The strings this segment's client components translate, beyond every page's (see ClientMessages). */
export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages scope="contact/layout">{children}</ClientMessages>
}
