// Text in the site's fonts: Readex Pro for reading, the condensed Bricolage Grotesque for titles
// (Alexandria for Arabic titles, picked from the text itself so a Latin title on an Arabic screen
// keeps the Latin face).
import { Text as RNText, type TextProps, type TextStyle, StyleSheet } from 'react-native'
import { colors, fonts, type as size } from '@/theme/tokens'

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/

type Tone = 'primary' | 'secondary' | 'tertiary' | 'red'
type Weight = 'regular' | 'medium' | 'semibold' | 'bold'

const TONE: Record<Tone, string> = { primary: colors.white, secondary: colors.text2, tertiary: colors.text3, red: colors.red }
const WEIGHT: Record<Weight, string> = { regular: fonts.text, medium: fonts.textMedium, semibold: fonts.textSemibold, bold: fonts.textBold }

type Props = TextProps & { tone?: Tone, weight?: Weight, size?: number }

/** Body text: 15px (22 on TV), Readex Pro, white unless toned down. */
export function Text({ tone = 'primary', weight = 'regular', size: fontSize = size.body, style, ...props }: Props) {
  return <RNText {...props} style={[{ color: TONE[tone], fontFamily: WEIGHT[weight], fontSize, writingDirection: 'auto' } as TextStyle, style]} />
}

type DisplayProps = TextProps & { size?: number, bold?: boolean, children: string | string[] | number | null | undefined }

const textOf = (children: DisplayProps['children']) => (Array.isArray(children) ? children.join('') : String(children ?? ''))

/** Titles: the display face, extra bold, tight leading (the site's font-display). */
export function Display({ size: fontSize = size.sectionTitle, bold = false, style, children, ...props }: DisplayProps) {
  const arabic = ARABIC.test(textOf(children))
  const family = arabic ? (bold ? fonts.displayArabicBold : fonts.displayArabic) : bold ? fonts.displayBold : fonts.display
  return (
    <RNText
      {...props}
      style={[styles.display, { fontFamily: family, fontSize, lineHeight: Math.round(fontSize * (arabic ? 1.35 : 1.02)) }, style]}
    >
      {children}
    </RNText>
  )
}

const styles = StyleSheet.create({
  display: { color: colors.white, writingDirection: 'auto', includeFontPadding: false },
})
