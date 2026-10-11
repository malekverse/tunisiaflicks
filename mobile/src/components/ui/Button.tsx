// The site's buttons: the red pill (the one primary action), the glass pill, and round icon buttons.
import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, isTV, radius } from '@/theme/tokens'
import { Focusable } from './Focusable'
import { Text } from './Text'

type Variant = 'primary' | 'secondary' | 'ghost'

type Props = {
  label: string
  icon?: ReactNode
  onPress: () => void
  variant?: Variant
  size?: 'default' | 'large'
  style?: StyleProp<ViewStyle>
  haptic?: boolean
  disabled?: boolean
  hasTVPreferredFocus?: boolean
  accessibilityLabel?: string
}

export function Button({ label, icon, onPress, variant = 'primary', size = 'default', style, haptic, disabled, hasTVPreferredFocus, accessibilityLabel }: Props) {
  const large = size === 'large'
  const height = isTV ? (large ? 64 : 54) : large ? 52 : 44
  return (
    <Focusable
      onPress={onPress}
      haptic={haptic}
      disabled={disabled}
      hasTVPreferredFocus={hasTVPreferredFocus}
      radius={height / 2}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.button,
        { height, paddingHorizontal: isTV ? 30 : large ? 26 : 20, borderRadius: radius.pill },
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {({ focused }) => (
        <>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text weight="semibold" size={isTV ? 20 : large ? 16 : 15} style={{ color: variant === 'secondary' && focused ? colors.black : colors.white }}>
            {label}
          </Text>
          {/* On TV the focused glass button turns white, like the site's TV mode. */}
          {isTV && focused && variant !== 'primary' ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.focusFill]} /> : null}
        </>
      )}
    </Focusable>
  )
}

type IconButtonProps = { icon: ReactNode, onPress: () => void, label: string, size?: number, style?: StyleProp<ViewStyle>, haptic?: boolean }

export function IconButton({ icon, onPress, label, size = isTV ? 56 : 44, style, haptic }: IconButtonProps) {
  return (
    <Focusable
      onPress={onPress}
      haptic={haptic}
      radius={size / 2}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      {icon}
    </Focusable>
  )
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  primary: {
    backgroundColor: colors.redDeep,
    // The red glows a little, like the site's primary button.
    shadowColor: colors.red,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  secondary: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
  icon: { zIndex: 1 },
  focusFill: { backgroundColor: colors.white, zIndex: -1 },
  iconButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
})
