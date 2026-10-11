// The app's navigation bar.
// - Phones: the site's floating glass bar at the bottom, the current tab in a white pill.
// - TV: a bar along the top (the site's TV mode): the logo, then the tabs; the focused tab turns
//   into a white pill, the current one keeps a red line.
import { useEffect, useRef, useState } from 'react'
import { Animated, I18nManager, StyleSheet, View } from 'react-native'
import type { ComponentProps } from 'react'
import type { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bookmark, Compass, House, Search, UserRound, type LucideIcon } from 'lucide-react-native'
import { useT, type StringKey } from '@/i18n'
import { haptics } from '@/lib/haptics'
import { colors, isTV, radius, sizes, space } from '@/theme/tokens'
import { Focusable } from '../ui/Focusable'
import { Text } from '../ui/Text'
import { Wordmark } from '../brand/Logo'

const TABS: Record<string, { icon: LucideIcon, label: StringKey }> = {
  index: { icon: House, label: 'nav.home' },
  discover: { icon: Compass, label: 'nav.discover' },
  search: { icon: Search, label: 'nav.search' },
  library: { icon: Bookmark, label: 'nav.library' },
  you: { icon: UserRound, label: 'nav.you' },
}

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT()
  const insets = useSafeAreaInsets()

  const go = (name: string, key: string, focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true })
    if (!focused && !event.defaultPrevented) navigation.navigate(name)
  }

  if (isTV) {
    return (
      <View style={styles.tvBar}>
        <View style={styles.tvLogo}><Wordmark height={20} /></View>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name]
          if (!tab) return null
          const current = state.index === index
          const Icon = tab.icon
          return (
            <Focusable key={route.key} onPress={() => go(route.name, route.key, current)} plain focusScale={1} accessibilityRole="tab" accessibilityState={{ selected: current }}>
              {({ focused }) => (
                <View style={[styles.tvTab, focused && styles.tvTabFocused]}>
                  <Icon size={22} color={focused ? colors.black : current ? colors.white : colors.text2} strokeWidth={2} />
                  <Text weight="semibold" size={19} style={{ color: focused ? colors.black : current ? colors.white : colors.text2 }}>{t(tab.label)}</Text>
                  {current && !focused ? <View style={styles.tvLine} /> : null}
                </View>
              )}
            </Focusable>
          )
        })}
      </View>
    )
  }

  return <PhoneBar state={state} go={go} />
}

/**
 * Phones: a glass bar floating over the bottom of the page. The white-glass pill slides to the chosen
 * tab (a spring, and a tick of the motor), and the chosen icon pops.
 */
function PhoneBar({ state, go }: { state: BottomTabBarProps['state'], go: (name: string, key: string, focused: boolean) => void }) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [slot, setSlot] = useState(0)
  const x = useRef(new Animated.Value(0)).current
  const routes = state.routes.filter((route) => TABS[route.name])
  const currentKey = state.routes[state.index]?.key
  const position = Math.max(0, routes.findIndex((route) => route.key === currentKey))
  // Right to left (Arabic), the row starts on the right and so does the pill (its `left` is mirrored
  // there), so it slides the other way.
  const offset = (I18nManager.isRTL ? -position : position) * slot

  const placed = useRef(false)
  useEffect(() => {
    if (!slot) return
    if (!placed.current) {
      x.setValue(offset)
      placed.current = true
      return
    }
    Animated.spring(x, { toValue: offset, useNativeDriver: true, damping: 20, stiffness: 260, mass: 0.8 }).start()
  }, [offset, slot, x])

  return (
    <View pointerEvents="box-none" style={[styles.phoneWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.phoneBar} onLayout={(event) => setSlot((event.nativeEvent.layout.width - 12) / routes.length)}>
        {slot ? <Animated.View pointerEvents="none" style={[styles.pill, { width: slot, transform: [{ translateX: x }] }]} /> : null}
        {routes.map((route) => {
          const tab = TABS[route.name]
          const current = route.key === currentKey
          return (
            <PhoneTab
              key={route.key}
              icon={tab.icon}
              label={t(tab.label)}
              current={current}
              onPress={() => {
                if (!current) haptics.tick()
                go(route.name, route.key, current)
              }}
            />
          )
        })}
      </View>
    </View>
  )
}

function PhoneTab({ icon: Icon, label, current, onPress }: { icon: LucideIcon, label: string, current: boolean, onPress: () => void }) {
  const pop = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!current) return
    pop.setValue(0.7)
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 300, mass: 0.6 }).start()
  }, [current, pop])
  return (
    <Focusable
      onPress={onPress}
      radius={radius.pill}
      containerStyle={styles.phoneSlot}
      accessibilityRole="tab"
      accessibilityState={{ selected: current }}
      accessibilityLabel={label}
      style={styles.phoneTab}
    >
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Icon size={22} color={current ? colors.white : colors.text3} strokeWidth={current ? 2.2 : 1.9} />
      </Animated.View>
      <Text weight={current ? 'semibold' : 'medium'} size={11} tone={current ? 'primary' : 'tertiary'} numberOfLines={1}>{label}</Text>
    </Focusable>
  )
}

/** The room the phone bar takes at the bottom of a page. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets()
  return isTV ? 0 : sizes.tabBar + Math.max(insets.bottom, 10) + 16
}

const styles = StyleSheet.create({
  phoneWrap: { position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: 12 },
  phoneBar: {
    flexDirection: 'row',
    height: sizes.tabBar,
    borderRadius: 32,
    padding: 6,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  phoneSlot: { flex: 1 },
  phoneTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 26 },
  pill: { position: 'absolute', left: 6, top: 6, bottom: 6, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.13)' },
  tvBar: {
    position: 'absolute',
    top: 28,
    start: space.page,
    end: space.page,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 76,
    paddingHorizontal: 14,
    borderRadius: 38,
    backgroundColor: 'rgba(18,18,18,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tvLogo: { paddingHorizontal: 14 },
  tvTab: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 56, paddingHorizontal: 18, borderRadius: 28 },
  tvTabFocused: { backgroundColor: colors.white },
  tvLine: { position: 'absolute', start: 20, end: 20, bottom: 4, height: 3, borderRadius: 2, backgroundColor: colors.red },
})
