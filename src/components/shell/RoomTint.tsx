"use client"
import { useAmbientColor } from '@/src/hooks/use-ambient-color'
import { useRoomLight } from './RoomLight'

/** For server pages: lights the room in the colour of a TMDB poster (or a fixed "r g b" colour). */
export default function RoomTint({ poster, color }: { poster?: string | null, color?: string }) {
  const found = useAmbientColor(color ? null : poster)
  useRoomLight(color ?? found)
  return null
}
