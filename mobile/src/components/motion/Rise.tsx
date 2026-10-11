// Content that arrives: it rises a little and fades in, after `delay` (rows one after another).
import { useEffect, useRef } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

export function Rise({ delay = 0, distance = 18, children, style }: { delay?: number, distance?: number, children: React.ReactNode, style?: StyleProp<ViewStyle> }) {
  const shown = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [shown, delay])
  return (
    <Animated.View style={[style, { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  )
}
