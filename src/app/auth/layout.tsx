import ClientMessages from '@/src/components/ClientMessages'

/** The strings this segment's client components translate, beyond every page's (see ClientMessages). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages scope="auth/layout">{children}</ClientMessages>
}
