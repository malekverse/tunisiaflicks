import Link from 'next/link'
import { ChevronDown, ChevronRight, MessageSquareText } from 'lucide-react'
import LegalToc, { type TocItem } from '@/src/components/info/LegalToc'
import { createTranslator, dateLocale } from '@/src/lib/i18n'
import { getLocale } from '@/src/lib/i18n/server'
import { LEGAL_UPDATED, getLegalDoc, type LegalPageId } from '@/src/lib/legal'

/** Anchor for a section (headings can be Arabic, so numbered ids rather than slugs). */
const sectionId = (index: number) => `section-${index + 1}`

/**
 * About / Privacy / Terms / DMCA: one readable long-form layout, in the visitor's language. A big
 * title, the "last updated" line and the intro, then the sections at a comfortable measure (~68ch)
 * with a sticky table of contents beside them on desktop (a fold-out list on phones). `extra` adds
 * a section passed as children (the DMCA form) to the contents.
 */
export default function LegalPage({ page, children, extra }: {
  page: LegalPageId
  children?: React.ReactNode
  extra?: TocItem
}) {
  const locale = getLocale()
  const t = createTranslator(locale)
  const doc = getLegalDoc(page, locale)
  const updated = new Date(`${LEGAL_UPDATED}T12:00:00Z`).toLocaleDateString(dateLocale(locale) ?? 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const toc: TocItem[] = [
    ...doc.sections.map((section, index) => ({ id: sectionId(index), label: section.heading })),
    ...(extra ? [extra] : []),
  ]

  return (
    <div className="page-top pb-10">
      <div className="page-x">
        <div className="lg:grid lg:grid-cols-[minmax(0,68ch)_minmax(200px,240px)] lg:justify-between lg:gap-16 xl:justify-start xl:gap-28">
          <article className="min-w-0 max-w-[68ch]">
            <header className="pt-4 sm:pt-8">
              <h1 className="text-balance font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95] text-white">{doc.title}</h1>
              {page !== 'about' && <p className="mt-4 text-[13px] text-white/50">{t('legal.updated', { date: updated })}</p>}
              <p className="mt-6 text-pretty text-[17px] leading-[1.7] text-white/80 sm:text-[19px]">{doc.intro}</p>
            </header>

            {toc.length > 2 && (
              <details className="group mt-8 rounded-[22px] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] lg:hidden">
                <summary className="flex h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-[14px] font-medium text-white/80 outline-none focus-visible:ring-2 focus-visible:ring-red-500 [&::-webkit-details-marker]:hidden">
                  {t('legal.onThisPage')}
                  <ChevronDown aria-hidden className="h-4 w-4 text-white/50 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <ol className="space-y-0.5 px-2 pb-3">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className="block rounded-xl px-3 py-2.5 text-[14px] text-white/65 outline-none transition-colors active:bg-white/[0.06] focus-visible:bg-white/[0.06]">
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            <div aria-hidden className="mb-10 mt-10 h-px bg-white/[0.07] sm:mt-12" />

            <div className="space-y-12">
              {doc.sections.map((section, index) => (
                <section key={section.heading} aria-labelledby={sectionId(index)}>
                  <h2 id={sectionId(index)} className="scroll-mt-[calc(var(--topbar)+32px)] text-balance font-display text-[24px] font-bold leading-tight text-white sm:text-[28px]">
                    {section.heading}
                  </h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="mt-4 text-pretty text-[16px] leading-[1.8] text-white/70">{paragraph}</p>
                  ))}
                  {section.bullets && (
                    <ul className="mt-5 space-y-3.5">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="relative ps-6 text-pretty text-[16px] leading-[1.75] text-white/70">
                          <span aria-hidden className="absolute start-1 top-[0.72em] h-1.5 w-1.5 rounded-full bg-white/35" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            {children}

            {page !== 'dmca' && (
              <Link
                href="/contact"
                className="group mt-16 flex items-center gap-4 rounded-[22px] bg-white/[0.04] p-5 outline-none ring-1 ring-inset ring-white/[0.07] transition-[background-color,transform] duration-200 ease-out hover:bg-white/[0.07] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-red-500 sm:p-6"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]">
                  <MessageSquareText aria-hidden className="h-5 w-5 text-white/80" strokeWidth={1.8} />
                </span>
                <span className="flex-1 text-[15px] font-medium text-white/85">{t('legal.reviewNote')}</span>
                <ChevronRight aria-hidden className="h-5 w-5 text-white/40 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
            )}
          </article>

          {toc.length > 2 && (
            <aside className="hidden pt-[calc(clamp(34px,5vw,64px)*0.95+2rem)] lg:block">
              <LegalToc items={toc} title={t('legal.onThisPage')} />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
