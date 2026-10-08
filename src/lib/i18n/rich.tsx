// Translated sentences with markup inside: names and titles isolated in <bdi> (so an Arabic name in
// an English sentence, or the reverse, can't scramble the word order), some of them in bold.
import React from 'react'
import type { TKey } from './en'
import type { Translate } from './translate'

type RichVars = Record<string, React.ReactNode | string | number>

/**
 * `richT(t, 'social.sent', { name: 'Amine', title: 'Dune' }, { bold: ['name'] })` gives the
 * translated sentence as React nodes: every `{var}` wrapped in <bdi>, the bold ones also in
 * <strong>. Placeholders without a value stay as written, like `t()`.
 */
export function richT(t: Translate, key: TKey, vars: RichVars, opts?: { bold?: string[] }): React.ReactNode {
  const parts = t(key).split(/\{(\w+)\}/g)
  // split() with a capture group alternates: text, name, text, name, ..., text.
  return parts.map((part, index) => {
    if (index % 2 === 0) return part ? <React.Fragment key={index}>{part}</React.Fragment> : null
    if (!(part in vars)) return <React.Fragment key={index}>{`{${part}}`}</React.Fragment>
    const value = <bdi>{vars[part]}</bdi>
    return opts?.bold?.includes(part)
      ? <strong key={index} className="font-semibold text-white">{value}</strong>
      : <React.Fragment key={index}>{value}</React.Fragment>
  })
}
