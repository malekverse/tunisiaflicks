// A question in the app's own clothes instead of the system's grey dialog: a sheet that rises from the
// bottom on phones (a dialog in the middle on TV, the remote on the main answer). Anything can ask:
//   if (await confirm({ title, text, ok: 'Close now', cancel: 'Cancel' })) …
import { useEffect, useRef } from 'react'
import { Animated, BackHandler, Pressable, StyleSheet, TVFocusGuideView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { create } from 'zustand'
import { haptics } from '@/lib/haptics'
import { colors, isTV, radius } from '@/theme/tokens'
import { Button } from '../ui/Button'
import { Display, Text } from '../ui/Text'

type Ask = { title: string, text?: string, ok: string, cancel: string, destructive?: boolean, icon?: React.ReactNode }
type Pending = Ask & { resolve: (answer: boolean) => void }

const useConfirmStore = create<{ pending: Pending | null }>(() => ({ pending: null }))

export function confirm(ask: Ask): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().pending?.resolve(false)
    haptics.tick()
    useConfirmStore.setState({ pending: { ...ask, resolve } })
  })
}

export function ConfirmHost() {
  const pending = useConfirmStore((state) => state.pending)
  const insets = useSafeAreaInsets()
  const shown = useRef(new Animated.Value(0)).current

  const answer = (yes: boolean) => {
    const current = useConfirmStore.getState().pending
    if (!current) return
    Animated.timing(shown, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      useConfirmStore.setState({ pending: null })
      current.resolve(yes)
    })
  }

  useEffect(() => {
    if (!pending) return
    shown.setValue(0)
    Animated.spring(shown, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 220, mass: 0.8 }).start()
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { answer(false); return true })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  if (!pending) return null
  return (
    <View style={[StyleSheet.absoluteFill, isTV ? styles.center : styles.bottom]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: shown }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => answer(false)} focusable={false} accessibilityLabel={pending.cancel} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.sheet, isTV ? styles.dialog : { paddingBottom: Math.max(insets.bottom, 16) + 8 }, {
          opacity: isTV ? shown : 1,
          transform: isTV
            ? [{ scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }]
            : [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) }],
        }]}
      >
        {isTV ? null : <View style={styles.grip} />}
        {pending.icon ? <View style={styles.icon}>{pending.icon}</View> : null}
        <Display size={isTV ? 32 : 24} style={styles.text} accessibilityRole="header">{pending.title}</Display>
        {pending.text ? <Text tone="secondary" size={isTV ? 20 : 15} style={[styles.text, { lineHeight: isTV ? 30 : 22 }]}>{pending.text}</Text> : null}
        {/* On TV the remote stays inside (trapped), starting on the answer that can't hurt. */}
        <TVFocusGuideView style={styles.buttons} trapFocusUp trapFocusDown trapFocusLeft trapFocusRight>
          <Button label={pending.ok} onPress={() => answer(true)} size="large" hasTVPreferredFocus={!pending.destructive} style={pending.destructive ? styles.destructive : undefined} />
          <Button label={pending.cancel} variant="secondary" onPress={() => answer(false)} size="large" hasTVPreferredFocus={pending.destructive} />
        </TVFocusGuideView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  bottom: { justifyContent: 'flex-end' },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    backgroundColor: 'rgb(22,22,22)',
    borderTopLeftRadius: radius.stage,
    borderTopRightRadius: radius.stage,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 12,
  },
  dialog: { width: 640, borderRadius: radius.stage, padding: 36, paddingTop: 32, gap: 16 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 8 },
  icon: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chip },
  text: { textAlign: 'center' },
  buttons: { gap: 10, marginTop: 10 },
  destructive: { backgroundColor: '#B42318' },
})
