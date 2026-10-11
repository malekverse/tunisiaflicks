// A pill to pick something (Movies or Shows, a genre, a season): glass, white when chosen or focused.
import { StyleSheet } from 'react-native'
import { colors, isTV, radius } from '@/theme/tokens'
import { Focusable } from './Focusable'
import { Text } from './Text'

type Props = { label: string, selected?: boolean, onPress: () => void, hasTVPreferredFocus?: boolean, role?: 'tab' | 'button' }

export function Chip({ label, selected = false, onPress, hasTVPreferredFocus, role = 'button' }: Props) {
  return (
    <Focusable
      onPress={onPress}
      plain
      radius={radius.pill}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityRole={role}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      {({ focused }) => (
        <Text
          weight="semibold"
          size={isTV ? 18 : 14}
          numberOfLines={1}
          style={[styles.chip, (selected || focused) && styles.on, { color: selected || focused ? colors.black : colors.white }]}
        >
          {label}
        </Text>
      )}
    </Focusable>
  )
}

const styles = StyleSheet.create({
  chip: {
    height: isTV ? 50 : 38,
    lineHeight: isTV ? 50 : 38,
    paddingHorizontal: isTV ? 22 : 16,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    textAlign: 'center',
  },
  on: { backgroundColor: colors.white, borderColor: colors.white },
})
