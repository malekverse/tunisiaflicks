// Pull to refresh, the TunisiaFlicks way: pull the page down and the logo's "A" fills with red from the
// bottom, like a projector warming up; at the point of no return it lights up (a tick of the motor) and
// says "Let go to roll"; let go and the page holds while a beam sweeps under the A and the reel changes;
// then it all slides back. TV has no pulling: a plain scroll view there.
//
// The page follows the finger (react-native-gesture-handler's pan, alongside the scroll view's own
// gesture, only when the page is at its top); everything else runs on the native driver.
import { forwardRef, useCallback, useMemo, useRef, useState } from 'react'
import { Animated, Easing, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import { useT } from '@/i18n'
import { haptics } from '@/lib/haptics'
import { colors, isTV } from '@/theme/tokens'
import { LogoMark } from '../brand/Logo'
import { Text } from '../ui/Text'

/** How far to pull before letting go refreshes, where the page waits while it does, and the most it moves. */
const ARM = 96
const HOLD = 92
const MAX = 170
/** The shortest the reel takes to change, so the moment is seen even when the answer is instant. */
const MIN_MS = 1100

type Phase = 'idle' | 'pulling' | 'armed' | 'loading'

// The further you pull, the harder it gets (like the end of a rubber band).
const rubber = (dy: number) => MAX * (1 - Math.exp(-dy / (MAX * 1.6)))

type Props = ScrollViewProps & {
  /** Reloads the page; the page holds until it settles. */
  onRefresh: () => Promise<unknown>
  /** Where the A sits from the top of the screen (below the status bar). */
  top?: number
}

export const RefreshScrollView = forwardRef<ScrollView, Props>(function RefreshScrollView({ onRefresh, top = 0, children, onScroll, ...props }, ref) {
  if (isTV) return <ScrollView ref={ref} onScroll={onScroll} {...props}>{children}</ScrollView>
  return <PullScroll ref={ref} onRefresh={onRefresh} top={top} onScroll={onScroll} {...props}>{children}</PullScroll>
})

const PullScroll = forwardRef<ScrollView, Props>(function PullScroll({ onRefresh, top = 0, children, onScroll, scrollEventThrottle, ...props }, ref) {
  const t = useT()
  const pull = useRef(new Animated.Value(0)).current
  const spin = useRef(new Animated.Value(0)).current
  const scrollY = useRef(0)
  const startedAtTop = useRef(false)
  const phaseRef = useRef<Phase>('idle')
  const [phase, setPhaseState] = useState<Phase>('idle')
  const setPhase = useCallback((next: Phase) => {
    if (phaseRef.current === next) return
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const settle = useCallback(() => {
    Animated.spring(pull, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 160, mass: 0.8 }).start()
    setPhase('idle')
  }, [pull, setPhase])

  const refresh = useCallback(async () => {
    setPhase('loading')
    haptics.tap()
    Animated.spring(pull, { toValue: HOLD, useNativeDriver: true, damping: 16, stiffness: 180 }).start()
    spin.setValue(0)
    const sweep = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }))
    sweep.start()
    const started = Date.now()
    try {
      await onRefresh()
    } catch {
      // The page shows its own error; the reel just stops.
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_MS - (Date.now() - started))))
    sweep.stop()
    settle()
  }, [onRefresh, pull, spin, settle, setPhase])

  const native = useMemo(() => Gesture.Native(), [])
  const pan = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .simultaneousWithExternalGesture(native)
    .onStart(() => {
      startedAtTop.current = scrollY.current <= 1 && phaseRef.current === 'idle'
    })
    .onUpdate((event) => {
      if (!startedAtTop.current) return
      const distance = rubber(Math.max(0, event.translationY))
      pull.setValue(distance)
      if (distance >= ARM && phaseRef.current !== 'armed') {
        haptics.tick()
        setPhase('armed')
      } else if (distance < ARM && distance > 2 && phaseRef.current !== 'pulling') {
        setPhase('pulling')
      }
    })
    .onEnd(() => {
      if (!startedAtTop.current) return
      startedAtTop.current = false
      if (phaseRef.current === 'armed') refresh()
      else settle()
    }), [native, pull, refresh, settle, setPhase])

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y
    onScroll?.(event)
  }, [onScroll])

  const label = phase === 'loading' ? t('refresh.loading') : phase === 'armed' ? t('refresh.release') : t('refresh.pull')

  return (
    <View style={{ flex: 1 }}>
      <ReelMark pull={pull} spin={spin} phase={phase} label={label} top={top} />
      <GestureDetector gesture={pan}>
        <Animated.View style={{ flex: 1, transform: [{ translateY: pull }] }}>
          <GestureDetector gesture={native}>
            <ScrollView
              ref={ref}
              {...props}
              onScroll={handleScroll}
              scrollEventThrottle={scrollEventThrottle ?? 16}
              overScrollMode="never"
            >
              {children}
            </ScrollView>
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    </View>
  )
})

const SIZE = 38

/** The A that fills as you pull, glows when ready, and has a beam sweeping under it while loading. */
function ReelMark({ pull, spin, phase, label, top }: { pull: Animated.Value, spin: Animated.Value, phase: Phase, label: string, top: number }) {
  const progress = pull.interpolate({ inputRange: [0, ARM], outputRange: [0, 1], extrapolate: 'clamp' })
  // The red part of the A, revealed from the bottom: the window moves up as the A inside moves down.
  const reveal = progress.interpolate({ inputRange: [0, 1], outputRange: [SIZE, 0] })
  const counter = progress.interpolate({ inputRange: [0, 1], outputRange: [-SIZE, 0] })
  const lit = phase === 'armed' || phase === 'loading'
  return (
    <View pointerEvents="none" style={[styles.mark, { top }]} importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: pull.interpolate({ inputRange: [0, 24, 60], outputRange: [0, 0.4, 1], extrapolate: 'clamp' }),
          transform: [
            { translateY: pull.interpolate({ inputRange: [0, HOLD], outputRange: [-30, 0], extrapolate: 'clamp' }) },
            { scale: pull.interpolate({ inputRange: [0, ARM, MAX], outputRange: [0.6, 1, 1.08], extrapolate: 'clamp' }) },
          ],
        }}
      >
        <View style={{ width: SIZE, height: SIZE * 0.86 }}>
          {/* The beam: a cone of red light under the A, sweeping while the reel changes. */}
          {phase === 'loading' ? (
            <Animated.View
              style={[styles.beam, {
                opacity: spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.9, 0.35] }),
                transform: [{ rotate: spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-18deg', '18deg', '-18deg'] }) }],
              }]}
            >
              <LinearGradient colors={['rgba(255,36,20,0.55)', 'rgba(255,36,20,0)']} style={styles.beamFill} />
            </Animated.View>
          ) : null}
          <LogoMark size={SIZE} color="rgba(255,255,255,0.14)" />
          <Animated.View style={[styles.window, { transform: [{ translateY: reveal }] }]}>
            <Animated.View style={{ transform: [{ translateY: counter }] }}>
              <LogoMark size={SIZE} color={lit ? colors.red : 'rgba(255,36,20,0.75)'} />
            </Animated.View>
          </Animated.View>
          {lit ? <View style={styles.glow} /> : null}
        </View>
        <Text tone={lit ? 'primary' : 'tertiary'} weight="medium" size={12.5} style={{ marginTop: 10 }}>{label}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  mark: { position: 'absolute', start: 0, end: 0, alignItems: 'center', zIndex: 0 },
  window: { position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE * 0.86, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    left: -SIZE * 0.4,
    top: -SIZE * 0.4,
    width: SIZE * 1.8,
    height: SIZE * 1.6,
    borderRadius: SIZE,
    backgroundColor: 'rgba(255,36,20,0.12)',
    zIndex: -1,
  },
  beam: { position: 'absolute', left: SIZE / 2 - 60, top: SIZE * 0.55, width: 120, height: 90, alignItems: 'center', transformOrigin: 'top' },
  beamFill: { width: 120, height: 90, borderTopLeftRadius: 60, borderTopRightRadius: 60 },
})
