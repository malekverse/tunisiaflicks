// The opening: the splash screen's red A rushes toward you and the app appears through it (once, at
// launch). It starts exactly where the splash leaves off: the same A, the same size, on black.
import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { colors } from '@/theme/tokens'
import { LogoMark } from '../brand/Logo'

export function Intro({ start, onDone }: { start: boolean, onDone: () => void }) {
  const go = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!start) return
    // The system splash leaves a moment after it's told to (once the next frames are drawn), and the
    // first screen is still being built: wait two frames and a breath, so the zoom is seen and smooth.
    let cancelled = false
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (cancelled) return
        Animated.timing(go, { toValue: 1, duration: 900, delay: 650, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onDone())
      })
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [go, onDone, start])
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, styles.black, { opacity: go.interpolate({ inputRange: [0, 0.5, 0.85], outputRange: [1, 1, 0], extrapolate: 'clamp' }) }]} />
      <Animated.View
        style={{
          opacity: go.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] }),
          transform: [{ scale: go.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1, 0.92, 16] }) }],
        }}
      >
        <LogoMark size={180} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  black: { backgroundColor: colors.black },
})
