// The film leader: the countdown at the head of a reel (3, 2, 1), a hand sweeping round the circle,
// crosshairs, a little grain. Shown while a player loads; it keeps counting until the film starts.
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { colors, fonts, isTV } from '@/theme/tokens'

export function FilmLeader({ size = isTV ? 220 : 170 }: { size?: number }) {
  const sweep = useRef(new Animated.Value(0)).current
  const flicker = useRef(new Animated.Value(1)).current
  const [count, setCount] = useState(3)

  useEffect(() => {
    const turn = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }))
    const flick = Animated.loop(Animated.sequence([
      Animated.timing(flicker, { toValue: 0.82, duration: 70, useNativeDriver: true }),
      Animated.timing(flicker, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.delay(420),
    ]))
    turn.start()
    flick.start()
    const timer = setInterval(() => setCount((n) => (n <= 1 ? 3 : n - 1)), 1000)
    return () => { turn.stop(); flick.stop(); clearInterval(timer) }
  }, [sweep, flicker])

  const ring = { width: size, height: size, borderRadius: size / 2 }
  return (
    <Animated.View style={[styles.frame, { width: size * 1.35, height: size * 1.05, opacity: flicker }]} importantForAccessibility="no-hide-descendants">
      <View style={[styles.cross, { width: size * 1.35, height: 1 }]} />
      <View style={[styles.cross, { width: 1, height: size * 1.05 }]} />
      <View style={[styles.ring, ring]} />
      <View style={[styles.ring, { width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41 }]} />
      {/* The hand: a line from the centre, turning once a second. */}
      <Animated.View style={[styles.hand, { width: size, height: size, transform: [{ rotate: sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
        <View style={[styles.needle, { height: size / 2 }]} />
      </Animated.View>
      <Animated.Text style={[styles.count, { fontSize: size * 0.5, lineHeight: size * 0.56 }]}>{count}</Animated.Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)' },
  cross: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.14)' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)' },
  hand: { position: 'absolute', alignItems: 'center' },
  needle: { width: 3, borderRadius: 2, backgroundColor: colors.red, shadowColor: colors.red, shadowOpacity: 0.9, shadowRadius: 8, elevation: 4 },
  count: { color: colors.white, fontFamily: fonts.display, includeFontPadding: false, textAlign: 'center' },
})
