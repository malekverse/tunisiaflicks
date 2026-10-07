/**
 * Not found / something broke: one big word lit from above like a projector hitting an empty
 * screen, what happened in a sentence, and the ways out. Usable from server and client pages.
 */
export default function StatusScreen({ big, title, text, children }: {
  /** The giant word ("404", "Oops"). Decorative: the title says it in words. */
  big: string
  title: string
  text: string
  /** Actions (primary first). */
  children: React.ReactNode
}) {
  return (
    <div className="page-top relative isolate overflow-hidden">
      {/* The beam: a cone of light from above, and a faint pool where it lands. */}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[90%] bg-[radial-gradient(42%_70%_at_50%_0%,rgb(255_255_255/0.10),rgb(255_255_255/0.03)_55%,transparent_80%)]" />
      <div aria-hidden className="absolute left-1/2 top-[38%] -z-10 h-40 w-[min(720px,90vw)] -translate-x-1/2 rounded-[100%] bg-white/[0.035] blur-3xl" />

      <div className="page-x flex min-h-[calc(100svh-var(--topbar)-env(safe-area-inset-top,0px)-12px-var(--tabbar-space))] flex-col items-center justify-center py-16 text-center">
        <p
          aria-hidden
          className="animate-focus-in select-none bg-gradient-to-b from-white from-10% via-white/60 to-white/0 to-95% bg-clip-text pb-[0.06em] font-display text-[clamp(120px,24vw,300px)] font-extrabold leading-[0.82] text-transparent"
        >
          {big}
        </p>
        <h1 className="mt-6 animate-focus-in text-balance font-display text-[clamp(28px,3.6vw,44px)] font-extrabold leading-[1.02] text-white [animation-delay:90ms]">{title}</h1>
        <p className="mt-3 max-w-[46ch] animate-focus-in text-pretty text-[15px] leading-relaxed text-white/60 [animation-delay:150ms] sm:text-[16px]">{text}</p>
        <div className="mt-9 flex w-full animate-focus-in flex-col items-stretch justify-center gap-3 [animation-delay:210ms] sm:w-auto sm:flex-row sm:items-center">
          {children}
        </div>
      </div>
    </div>
  )
}
