// TMDB's average with a filled star (the site's `fill-star`), one decimal.
import { StyleSheet, View } from 'react-native'
import { Star } from 'lucide-react-native'
import { colors, isTV } from '@/theme/tokens'
import { useLocale } from '@/i18n'
import { Text } from './Text'

export function Rating({ value, small = false }: { value: number, small?: boolean }) {
  const locale = useLocale()
  const size = isTV ? (small ? 16 : 22) : small ? 12 : 15
  return (
    <View style={styles.row} accessibilityLabel={`${value.toFixed(1)} / 10`}>
      <Star size={size} color={colors.star} fill={colors.star} strokeWidth={0} />
      <Text weight="semibold" size={size} style={{ fontVariant: ['tabular-nums'] }}>
        {value.toLocaleString(locale === 'en' ? 'en-US' : locale === 'fr' ? 'fr-FR' : 'ar-u-nu-latn', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
})
