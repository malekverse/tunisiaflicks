// A short message that rises from the bottom and goes away by itself ("Added to My List"), one at a
// time. Anything can show one: toast('…'). The host lives in the root layout.
import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { create } from 'zustand'
import { colors, isTV, radius, sizes } from '@/theme/tokens'
import { Text } from '../ui/Text'

type ToastState = { id: number, text: string, icon?: React.ReactNode }
const useToastStore = create<{ current: ToastState | null }>(() => ({ current: null }))

export function toast(text: string, icon?: React.ReactNode) {
  useToastStore.setState({ current: { id: Date.now(), text, icon } })
}

export function ToastHost() {
  const current = useToastStore((state) => state.current)
  const insets = useSafeAreaInsets()
  const shown = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!current) return
    shown.setValue(0)
    Animated.spring(shown, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 220, mass: 0.7 }).start()
    const timer = setTimeout(() => {
      Animated.timing(shown, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished && useToastStore.getState().current?.id === current.id) useToastStore.setState({ current: null })
      })
    }, 2200)
    return () => clearTimeout(timer)
  }, [current, shown])

  if (!current) return null
  // Above the phone's tab bar; near the bottom on TV.
  const bottom = isTV ? 48 : sizes.tabBar + Math.max(insets.bottom, 10) + 28
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: bottom }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[styles.toast, {
          opacity: shown,
          transform: [
            { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        }]}
      >
        {current.icon}
        <Text weight="medium" size={isTV ? 19 : 14}>{current.text}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(28,28,28,0.97)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    maxWidth: '88%',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
})
