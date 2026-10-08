"use client"
import React, { forwardRef, useState } from 'react'
import { cn } from '@/src/lib/utils'

export const CODE_LENGTH = 6

/**
 * What the user typed or pasted, as a room code: uppercased, letters and digits only. A pasted
 * invite link ("…/swipe/ABC234") gives its code.
 */
export function cleanCode(raw: string) {
  const link = raw.match(/swipe\/([a-z0-9]{6})/i)
  return (link ? link[1] : raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
}

/**
 * A 6-box room code field. It is one real input laid over six boxes, so typing advances on its
 * own, backspace goes back, and pasting a code (or a whole invite link) fills every box at once.
 * Codes are Latin in every language, so the boxes always read left to right.
 */
const CodeInput = forwardRef<HTMLInputElement, {
  id?: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
}>(function CodeInput({ id, value, onChange, invalid, describedBy }, ref) {
  const [focused, setFocused] = useState(false)
  const active = Math.min(value.length, CODE_LENGTH - 1)
  const keepCaretAtEnd = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const end = input.value.length
    if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end)
  }

  return (
    <div className="relative" dir="ltr">
      <input
        ref={ref}
        id={id}
        value={value}
        onChange={(event) => onChange(cleanCode(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSelect={keepCaretAtEnd}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="absolute inset-0 z-10 h-full w-full cursor-text rounded-xl bg-transparent text-[16px] text-transparent caret-transparent opacity-0 outline-none"
      />
      <div aria-hidden className="flex gap-2">
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const char = value[index]
          const current = focused && index === active
          return (
            <span
              key={index}
              className={cn(
                'relative grid h-14 min-w-0 max-w-[54px] flex-1 place-items-center rounded-xl bg-white/[0.06] font-display text-[26px] font-bold text-white ring-1 transition-[box-shadow,background-color] duration-150',
                index === CODE_LENGTH / 2 && 'ms-2.5',
                current ? 'bg-white/[0.09] ring-2 ring-red-500/80' : invalid ? 'ring-red-400/50' : 'ring-white/10',
              )}
            >
              {char
                ? <span key={char + index} className="animate-in fade-in zoom-in-90 duration-150">{char}</span>
                : current && <span className="h-7 w-[2px] animate-pulse rounded-full bg-red-500" />}
            </span>
          )
        })}
      </div>
    </div>
  )
})

export default CodeInput
