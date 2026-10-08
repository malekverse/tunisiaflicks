// Wrapped stats are computed (and shared snapshots stored) with English labels: the viewer
// personality comes from lib/wrapped.ts, genre names from TMDB in English. These map them back to
// the interface language, falling back to the stored text for anything unknown.
import { Compass, Drama, Lightbulb, Moon, Music, Rocket, Search, Smile, Zap, type LucideIcon } from 'lucide-react'
import type { Locale, TKey, Translate } from '@/src/lib/i18n'
import { genreNames } from '@/src/lib/genres'

const PERSONAS: Record<string, { title: TKey, blurb: TKey, icon: LucideIcon }> = {
  'The Adrenaline Junkie': { title: 'wrapped.persona.adrenaline', blurb: 'wrapped.persona.adrenalineBlurb', icon: Zap },
  'The Good-Vibes Seeker': { title: 'wrapped.persona.goodVibes', blurb: 'wrapped.persona.goodVibesBlurb', icon: Smile },
  'The Deep Feeler': { title: 'wrapped.persona.deepFeeler', blurb: 'wrapped.persona.deepFeelerBlurb', icon: Drama },
  'The Night Owl': { title: 'wrapped.persona.nightOwl', blurb: 'wrapped.persona.nightOwlBlurb', icon: Moon },
  'The Detective': { title: 'wrapped.persona.detective', blurb: 'wrapped.persona.detectiveBlurb', icon: Search },
  'The World Traveler': { title: 'wrapped.persona.worldTraveler', blurb: 'wrapped.persona.worldTravelerBlurb', icon: Rocket },
  'The Curious Mind': { title: 'wrapped.persona.curiousMind', blurb: 'wrapped.persona.curiousMindBlurb', icon: Lightbulb },
  'The Rhythm Lover': { title: 'wrapped.persona.rhythmLover', blurb: 'wrapped.persona.rhythmLoverBlurb', icon: Music },
  'The Explorer': { title: 'wrapped.persona.explorer', blurb: 'wrapped.persona.explorerBlurb', icon: Compass },
}

export function personaOf(personality: { title: string, blurb: string }, t: Translate) {
  const known = PERSONAS[personality.title]
  return known
    ? { title: t(known.title), blurb: t(known.blurb), icon: known.icon }
    : { title: personality.title, blurb: personality.blurb, icon: Compass }
}

// Every TMDB movie and TV genre id, to look English names up in lib/genres.
const GENRE_IDS = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37, 10759, 10762, 10763, 10764, 10765, 10766, 10767, 10768]

export function genreLabel(name: string, locale: Locale) {
  if (locale === 'en') return name
  const id = GENRE_IDS.find((genre) => genreNames([genre], 'en')[0] === name)
  return (id && genreNames([id], locale)[0]) || name
}
