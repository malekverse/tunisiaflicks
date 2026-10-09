import 'server-only'
import { clientMessages, type MessageScope } from '@/src/lib/i18n'
import { getLocale } from '@/src/lib/i18n/server'
import { I18nScope } from '@/src/components/I18nProvider'

/**
 * The strings the client components under it translate, beyond the shell the root layout sends
 * to every page. A segment's layout wraps everything it renders in it (a page that has no layout
 * of its own, its content), named after its file: `<ClientMessages scope="movie-night/layout">`.
 * `npm run i18n:keys` works out each scope's keys (scripts/client-i18n-keys.mjs); a page without
 * a scope gets its strings from the shell, which then carries them on every page.
 */
export default function ClientMessages({ scope, children }: { scope: MessageScope, children: React.ReactNode }) {
  return <I18nScope messages={clientMessages(getLocale(), scope)}>{children}</I18nScope>
}
