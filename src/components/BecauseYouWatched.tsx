"use client"
import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { PosterSlider } from '@/src/components/Sliders'
import { useT } from '@/src/components/I18nProvider'

type Row = { seed: { id: string, title: string, media_type: 'movie' | 'tv' }, items: any[] }

/**
 * Personalised "Because you watched X" rows (signed-in users with some history or favorites).
 * Renders nothing otherwise, so the home page is unchanged for guests and new accounts.
 */
export default function BecauseYouWatched() {
  const { status } = useSession()
  const t = useT()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (status !== 'authenticated') {
      setRows([])
      return
    }
    const controller = new AbortController()
    fetch('/api/recommendations', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { rows: [] }))
      .then((data) => setRows(data.rows ?? []))
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('Error loading recommendations:', error)
      })
    return () => controller.abort()
  }, [status])

  if (rows.length === 0) return null

  return (
    <>
      {rows.map((row) => (
        <PosterSlider
          key={`${row.seed.media_type}-${row.seed.id}`}
          title={t('home.becauseYouWatched', { title: row.seed.title })}
          items={row.items}
          kind={row.seed.media_type}
        />
      ))}
    </>
  )
}
