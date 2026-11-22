// A taste match score (lib/taste) as a ring that fills up, in the site's red: it is a measure,
// like progress. No hooks: works on server and client pages alike.
/** The score as a ring that fills up (the site's red: it is a measure, like progress). */
export default function ScoreRing({ score, size = 104 }: { score: number | null, size?: number }) {
  const radius = 42
  const length = 2 * Math.PI * radius
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="8" />
        {score !== null && (
          <circle
            cx="50" cy="50" r={radius} fill="none" stroke="#FF2414" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * length} ${length}`}
            className="animate-[taste-ring_900ms_cubic-bezier(0.23,1,0.32,1)_both]"
            style={{ ['--taste-length' as string]: `${length}` }}
          />
        )}
      </svg>
      <span dir="ltr" className="font-display font-extrabold leading-none text-white" style={{ fontSize: size * 0.28 }}>
        {score === null ? '?' : <>{score}<span style={{ fontSize: size * 0.15 }}>%</span></>}
      </span>
    </span>
  )
}
