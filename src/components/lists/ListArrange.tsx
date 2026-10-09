"use client"
// "Arrange": the list as rows you can drag by their handle (touch, pen or mouse), with up/down
// buttons beside every handle for anyone who can't or won't drag. While a row is held, other
// people's changes wait (onHolding), so nothing moves under the finger; the move is sent on release.
import { useEffect, useRef, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import TmdbImage from '@/src/components/TmdbImage'
import { haptic, spring } from '@/src/lib/motion'
import { itemKey } from '@/src/lib/shared-lists/rules'
import type { SharedListItem } from '@/src/lib/shared-lists/types'
import { cn } from '@/src/lib/utils'

function Row({ item, index, count, disabled, onMove, onDragStart, onDragEnd, by }: {
  item: SharedListItem
  index: number
  count: number
  disabled: boolean
  onMove: (to: number) => void
  onDragStart: () => void
  onDragEnd: () => void
  by: React.ReactNode
}) {
  const t = useT()
  const controls = useDragControls()
  const [dragging, setDragging] = useState(false)
  const arrow = 'pressable grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/70 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-30'
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      transition={spring.ui}
      onDragStart={() => { setDragging(true); haptic(6); onDragStart() }}
      onDragEnd={() => { setDragging(false); onDragEnd() }}
      className={cn(
        'relative flex items-center gap-3 rounded-2xl bg-white/[0.04] py-1.5 pe-1.5 ps-2.5 ring-1 ring-inset ring-white/[0.06] [-webkit-touch-callout:none] select-none',
        dragging && 'z-10 bg-white/[0.09] shadow-[0_18px_40px_-14px_rgb(0_0_0/0.95)] ring-white/15',
      )}
    >
      <span aria-hidden className="w-6 shrink-0 text-center text-[13px] font-semibold tabular-nums text-white/55">{index + 1}</span>
      <span className="relative block h-[60px] w-10 shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
        <TmdbImage kind="poster" path={item.poster_path} alt="" fill sizes="40px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <bdi className="block truncate text-[14.5px] font-medium text-white">{item.title}</bdi>
        {by}
      </span>
      <button type="button" className={arrow} disabled={disabled || index === 0} onClick={() => onMove(index - 1)} aria-label={t('sharedLists.moveUp', { title: item.title })}>
        <ChevronUp aria-hidden className="h-5 w-5" />
      </button>
      <button type="button" className={arrow} disabled={disabled || index === count - 1} onClick={() => onMove(index + 1)} aria-label={t('sharedLists.moveDown', { title: item.title })}>
        <ChevronDown aria-hidden className="h-5 w-5" />
      </button>
      <span
        aria-hidden
        title={t('sharedLists.dragHandle', { title: item.title })}
        onPointerDown={(event) => { if (!disabled) controls.start(event) }}
        className={cn('grid h-11 w-11 shrink-0 cursor-grab touch-none place-items-center rounded-full text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white active:cursor-grabbing', disabled && 'pointer-events-none opacity-30')}
      >
        <GripVertical className="h-5 w-5" />
      </span>
    </Reorder.Item>
  )
}

export default function ListArrange({ items, disabled, onMove, onHolding, byLine }: {
  items: SharedListItem[]
  disabled: boolean
  /** One title to a new position (sent to the server). */
  onMove: (key: string, to: number) => void
  /** True while a row is held: other people's changes wait. */
  onHolding: (holding: boolean) => void
  byLine: (item: SharedListItem) => React.ReactNode
}) {
  const [order, setOrder] = useState(items)
  const dragging = useRef<string | null>(null)

  // Follow the list as it changes (ours confirmed, or someone else's landing), except mid-drag.
  useEffect(() => {
    if (!dragging.current) setOrder(items)
  }, [items])

  return (
    <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
      {order.map((item, index) => (
        <Row
          key={itemKey(item)}
          item={item}
          index={index}
          count={order.length}
          disabled={disabled}
          by={byLine(item)}
          onMove={(to) => onMove(itemKey(item), to)}
          onDragStart={() => { dragging.current = itemKey(item); onHolding(true) }}
          onDragEnd={() => {
            const key = dragging.current
            dragging.current = null
            const to = key ? order.findIndex((entry) => itemKey(entry) === key) : -1
            const from = key ? items.findIndex((entry) => itemKey(entry) === key) : -1
            if (key && to >= 0 && to !== from) onMove(key, to)
            onHolding(false)
          }}
        />
      ))}
    </Reorder.Group>
  )
}
