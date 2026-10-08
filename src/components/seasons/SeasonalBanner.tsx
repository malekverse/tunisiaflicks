// STUB: implemented by seasons in wave 1; keep the signature
// Home slot 3: at most one seasonal banner (Ramadan, the Eids, New Year, "Your year"...), from
// getSeasonalBanner() in src/lib/seasons.ts. Until then it shows today's Ramadan banner, so the home
// page is unchanged.
import RamadanBanner from '@/src/components/ramadan/RamadanBanner'

export default async function SeasonalBanner({ kids }: { kids?: boolean }): Promise<JSX.Element | null> {
  void kids
  return <RamadanBanner />
}
