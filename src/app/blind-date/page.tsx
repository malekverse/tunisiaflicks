import BlindDateApp from '@/src/components/blind-date/BlindDateApp'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

// Blind date with a film: the page carries no data (the films come from getBlindDates when asked),
// so it's the same static page for everyone.
export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('blindDate.title'), description: t('blindDate.subtitle'), path: '/blind-date', card: 'blind-date' })
}

export default function BlindDatePage() {
  return <BlindDateApp />
}
