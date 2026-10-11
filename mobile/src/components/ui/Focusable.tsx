// Everything you can press: a soft press-in on phones (the site's `pressable`), and on a TV the
// remote's focus: the focused item lifts and gets a white ring (the site's TV mode).
// (React Native's own Animated, on the native driver: Reanimated's synchronous updates kept retrying
// views that were gone and starved the main thread.)
import { forwardRef, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, View, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, isTV } from '@/theme/tokens'

const SPRING = { damping: 22, stiffness: 320, mass: 0.6, useNativeDriver: true }

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>
  /** The pressable area's own style (e.g. flex: 1 to share a row). */
  containerStyle?: StyleProp<ViewStyle>
  children: ReactNode | ((state: { focused: boolean }) => ReactNode)
  /** How much a focused item grows on TV (1 = not at all). */
  focusScale?: number
  /** The focus ring's corner radius (match the item's). */
  radius?: number
  /** A light tap of the motor on meaningful presses (Play, My List). */
  haptic?: boolean
  /** No ring on TV (for items that show their own focus state). */
  plain?: boolean
}

export const Focusable = forwardRef<View, Props>(function Focusable(
  { style, containerStyle, children, focusScale = 1.06, radius = 12, haptic = false, plain = false, hasTVPreferredFocus, onPress, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const scale = useRef(new Animated.Value(1)).current
  const to = (value: number, spring = true) => (spring
    ? Animated.spring(scale, { toValue: value, ...SPRING })
    : Animated.timing(scale, { toValue: value, duration: 90, useNativeDriver: true })).start()
  const animated = { transform: [{ scale }] }

  return (
    <Pressable
      ref={ref}
      {...props}
      style={containerStyle}
      // Phones take this too (and would show the TV's focus): TV only.
      hasTVPreferredFocus={isTV && hasTVPreferredFocus}
      onPress={(event) => {
        if (haptic && !isTV) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        onPress?.(event)
      }}
      onPressIn={() => { if (!isTV) to(0.96, false) }}
      onPressOut={() => { if (!isTV) to(1) }}
      onFocus={(event) => {
        if (isTV) setFocused(true)
        if (isTV) to(focusScale)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        if (isTV) to(1)
        onBlur?.(event)
      }}
    >
      <Animated.View style={[style, animated]}>
        {typeof children === 'function' ? children({ focused }) : children}
        {isTV && focused && !plain && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: radius + 3 }]} />}
      </Animated.View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  ring: { margin: -3, borderWidth: 3, borderColor: colors.white },
})
