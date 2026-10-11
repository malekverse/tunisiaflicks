// The brand: the red "A", the wordmark, and the loader (the A breathing, like the site's brand loader).
import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import Svg, { Path } from 'react-native-svg'
import { A_PATH } from '@/theme/logo'
import { colors } from '@/theme/tokens'

export function LogoMark({ size = 28, color = colors.red }: { size?: number, color?: string }) {
  return (
    <Svg width={size} height={size * 0.86} viewBox="5 11 90 78">
      <Path d={A_PATH} fill={color} />
    </Svg>
  )
}

const WORDMARK = require('../../../assets/brand/wordmark.png')

export function Wordmark({ height = 16 }: { height?: number }) {
  return <Image source={WORDMARK} style={{ height, width: height * (911 / 120) }} contentFit="contain" accessibilityLabel="TunisiaFlicks" />
}

/** The loader: the A glows in and out. */
export function Loader({ size = 46 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0.35)).current
  useEffect(() => {
    const ease = Easing.inOut(Easing.quad)
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: ease, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.35, duration: 900, easing: ease, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [pulse])
  const style = { opacity: pulse, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={[style, styles.glow]}>
        <LogoMark size={size} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 160 },
  glow: { shadowColor: colors.red, shadowOpacity: 0.8, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
})
