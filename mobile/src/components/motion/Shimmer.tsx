// Placeholders in the shape of what's coming (a billboard, rows of posters, a grid), with a slow sheen
// passing over them: the screen looks ready before the pictures are.
import { createContext, useContext, useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { isTV, radius, sizes, space } from '@/theme/tokens'

// One sheen for the whole screen, so every placeholder shines in step.
const Sheen = createContext<Animated.Value | null>(null)

export function ShimmerGroup({ children }: { children: React.ReactNode }) {
  const sheen = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(sheen, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [sheen])
  return <Sheen.Provider value={sheen}>{children}</Sheen.Provider>
}

export function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  const sheen = useContext(Sheen)
  const { width } = useWindowDimensions()
  return (
    <View style={[styles.bone, style]}>
      {sheen ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-width, width] }) }] }]}>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width, height: '100%' }} />
        </Animated.View>
      ) : null}
    </View>
  )
}

/** A row's worth: a title, then posters (or landscape tiles). */
export function RowBones({ landscape = false }: { landscape?: boolean }) {
  const w = landscape ? sizes.landscape : sizes.poster
  return (
    <View style={{ gap: 12 }}>
      <Bone style={{ width: isTV ? 260 : 150, height: isTV ? 26 : 18, borderRadius: 6, marginHorizontal: space.page }} />
      <View style={{ flexDirection: 'row', gap: space.gap, paddingHorizontal: space.page, overflow: 'hidden' }}>
        {Array.from({ length: 6 }, (_, i) => <Bone key={i} style={{ width: w, height: landscape ? w * 0.5625 : w * 1.5, borderRadius: landscape ? radius.tile : radius.poster }} />)}
      </View>
    </View>
  )
}

/** Home while it loads: the billboard and a few rows. */
export function HomeBones({ top }: { top: number }) {
  const { width, height } = useWindowDimensions()
  return (
    <ShimmerGroup>
      <View style={{ paddingTop: top, gap: space.section }} accessibilityLabel="Loading" accessibilityRole="progressbar">
        {isTV
          ? <Bone style={{ height: height * 0.6, borderRadius: 0 }} />
          : <Bone style={{ height: (width - space.page * 2) * 1.2, marginHorizontal: space.page, borderRadius: radius.stage }} />}
        <RowBones />
        <RowBones landscape />
      </View>
    </ShimmerGroup>
  )
}

/** A grid of posters while results load. */
export function GridBones({ columns, cardWidth }: { columns: number, cardWidth: number }) {
  return (
    <ShimmerGroup>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.gap, rowGap: isTV ? 26 : 18 }}>
        {Array.from({ length: columns * 3 }, (_, i) => <Bone key={i} style={{ width: cardWidth, height: cardWidth * 1.5, borderRadius: radius.poster }} />)}
      </View>
    </ShimmerGroup>
  )
}

const styles = StyleSheet.create({
  bone: { backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
})
