// The launch screen of the apps: the "A" folds in, the wordmark wipes in beside it, then it fades
// to the page (under a second and a half). Always in the HTML, hidden: LAUNCH_SCRIPT
// (src/lib/launch-script.ts) shows it only when an app starts. Sized to the screen, so it reads the
// same on a phone and a 4K TV.
import Image from 'next/image'
import { MARK_STROKES, MARK_VIEWBOX } from './BrandMark'

export default function AppLaunch() {
  return (
    <div aria-hidden className="tf-launch-screen">
      <div className="flex items-center gap-[2.4vmin]" dir="ltr">
        <svg viewBox={MARK_VIEWBOX} className="tf-launch-mark tf-launch-glow h-[13vmin] w-auto fill-[#ff0f00]">
          {MARK_STROKES.map((d) => <path key={d} d={d} />)}
        </svg>
        <Image src="/TunisiaFlicks.svg" alt="" width={300} height={40} priority className="tf-launch-wordmark h-[5.4vmin] w-auto" />
      </div>
    </div>
  )
}
