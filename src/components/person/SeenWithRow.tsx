// A person page's first row for a signed-in profile: the titles of theirs it has already watched
// ("You've seen Keanu Reeves in"), from its own history, with a note that only it sees this.
import { Lock } from 'lucide-react'
import { PosterSlider } from '@/src/components/Sliders'

export default function SeenWithRow({ title, note, items }: {
  /** 'You've seen {name} in', translated. */
  title: string
  /** 'From your watch history. Only you can see this.', translated. */
  note: string
  /** TMDB credits (with media_type), most recently watched first. */
  items: any[]
}) {
  if (!items.length) return null
  return (
    <PosterSlider
      title={title}
      kind="mixed"
      items={items}
      subtitle={(
        <span className="inline-flex items-center gap-1.5">
          <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {note}
        </span>
      )}
    />
  )
}
