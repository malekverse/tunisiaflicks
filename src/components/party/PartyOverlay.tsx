"use client"
// Over the player while a party is on (inside the frame, so it shows in full screen too): the
// reactions floating up, and a short line when someone else plays, pauses, jumps or moves on.
// Never in the way: no pointer events.
import React from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import type { PartyEvent, PartyNote } from './use-watch-party'

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export default function PartyOverlay({ events }: { events: PartyEvent[] }) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const reactions = events.filter((event): event is Extract<PartyEvent, { kind: 'react' }> => event.kind === 'react')
  const notes = events.filter((event): event is Extract<PartyEvent, { kind: 'note' }> => event.kind === 'note').slice(-2)

  const noteText = (note: PartyNote) => {
    const name = note.name || t('party.someone')
    switch (note.what) {
      case 'played': return t('party.note.played', { name })
      case 'paused': return t('party.note.paused', { name })
      case 'jumped': return t('party.note.jumped', { name, time: clock(note.at ?? 0) })
      case 'joined': return t('party.note.joined', { name })
      case 'left': return t('party.note.left', { name })
      case 'next': return t('party.note.next', { name })
    }
  }

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <div className="absolute start-[3%] top-[4%] flex flex-col items-start gap-1.5">
        <AnimatePresence>
          {notes.map((event) => (
            <m.p
              key={event.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-full bg-black/70 px-3 py-1.5 text-[13px] font-medium text-white ring-1 ring-white/10 backdrop-blur-md"
            >
              {noteText(event.text)}
            </m.p>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {reactions.map((event) => {
          // Each reaction rises from its own spot along the bottom right.
          const lane = (event.id * 37) % 24
          return (
            <m.div
              key={event.id}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={reduceMotion ? { opacity: [0, 1, 1, 0] } : { opacity: [0, 1, 1, 0], y: -180, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, ease: 'easeOut' }}
              className="absolute bottom-[12%] flex flex-col items-center"
              style={{ insetInlineEnd: `${6 + lane}%` }}
            >
              <span aria-hidden className="text-[40px] leading-none drop-shadow-[0_4px_12px_rgb(0_0_0/0.6)]">{event.emoji}</span>
              <span className="mt-1 rounded-full bg-black/60 px-2 py-0.5 text-[11.5px] font-medium text-white/90">{event.name}</span>
            </m.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
