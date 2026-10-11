// The room light: a soft glow from the top of the screen, red by default, or tinted by the picture on
// screen (the site's RoomLight). Decorative: it never takes touches or the screen reader's attention.
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

export function RoomLight({ color = '#FF2414', strength = 0.32, height = 0.7 }: { color?: string, strength?: number, height?: number }) {
  const { width, height: screen } = useWindowDimensions()
  const h = screen * height
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={h}>
        <Defs>
          <RadialGradient id="room" cx="50%" cy="-8%" rx="85%" ry="62%" fx="50%" fy="-8%">
            <Stop offset="0" stopColor={color} stopOpacity={strength} />
            <Stop offset="0.45" stopColor={color} stopOpacity={strength * 0.3} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={h} fill="url(#room)" />
      </Svg>
    </View>
  )
}
