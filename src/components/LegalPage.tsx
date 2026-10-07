import Link from 'next/link'
import { createTranslator, dateLocale } from '@/src/lib/i18n'
import { getLocale } from '@/src/lib/i18n/server'
import { LEGAL_UPDATED, getLegalDoc, type LegalPageId } from '@/src/lib/legal'

/** About / Privacy / Terms / DMCA: one readable article layout, in the visitor's language. */
export default function LegalPage({ page, children }: { page: LegalPageId, children?: React.ReactNode }) {
  const locale = getLocale()
  const t = createTranslator(locale)
  const doc = getLegalDoc(page, locale)
  const updated = new Date(`${LEGAL_UPDATED}T12:00:00Z`).toLocaleDateString(dateLocale(locale) ?? 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <article className="w-full max-w-3xl px-4 sm:px-6 pb-8">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold">{doc.title}</h1>
        {page !== 'about' && <p className="mt-2 text-sm text-gray-500">{t('legal.updated', { date: updated })}</p>}
        <p className="mt-5 text-lg leading-relaxed text-gray-700 dark:text-gray-300">{doc.intro}</p>
      </header>

      <div className="space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-3 text-xl font-semibold">{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mb-3 leading-relaxed text-gray-700 dark:text-gray-300">{paragraph}</p>
            ))}
            {section.bullets && (
              <ul className="list-disc space-y-2 ps-5 leading-relaxed text-gray-700 marker:text-red-500 dark:text-gray-300">
                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>

      {children}

      {page !== 'dmca' && (
        <p className="mt-10 text-sm text-gray-500">
          <Link href="/contact" className="text-red-500 hover:underline">{t('legal.reviewNote')}</Link>
        </p>
      )}
    </article>
  )
}
