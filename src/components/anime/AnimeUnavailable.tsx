import RetryButton from '@/src/components/dramas/RetryButton'
import { getT } from '@/src/lib/i18n/server'

/** AniList didn't answer (down, or the minute's requests are spent): say so, and offer to try again. */
export default function AnimeUnavailable() {
  const t = getT()
  return (
    <div className="page-top page-x flex min-h-[60svh] flex-col items-center justify-center gap-5 pb-10 text-center">
      <p className="max-w-sm text-[15px] text-white/65">{t('anime.error')}</p>
      <RetryButton label={t('anime.retry')} />
    </div>
  )
}
