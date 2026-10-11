// The app's navigation bar.
// - Phones: the site's floating glass bar at the bottom, the current tab in a white pill.
// - TV: a bar along the top (the site's TV mode): the logo, then the tabs; the focused tab turns
//   into a white pill, the current one keeps a red line.
import { StyleSheet, View } from 'react-native'
import type { ComponentProps } from 'react'
import type { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bookmark, Compass, House, Search, UserRound, type LucideIcon } from 'lucide-react-native'
import { useT, type StringKey } from '@/i18n'
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
        <View style={styles.tvLogo}><Wordmark height={22} /></View>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name]
          if (!tab) return null
          const current = state.index === index
          const Icon = tab.icon
          return (
            <Focusable key={route.key} onPress={() => go(route.name, route.key, current)} plain focusScale={1} accessibilityRole="tab" accessibilityState={{ selected: current }}>
              {({ focused }) => (
                <View style={[styles.tvTab, focused && styles.tvTabFocused]}>
                  <Icon size={24} color={focused ? colors.black : current ? colors.white : colors.text2} strokeWidth={2} />
                  <Text weight="semibold" size={20} style={{ color: focused ? colors.black : current ? colors.white : colors.text2 }}>{t(tab.label)}</Text>
                  {current && !focused ? <View style={styles.tvLine} /> : null}
                </View>
              )}
            </Focusable>
          )
        })}
      </View>
    )
  }

  return (
    <View pointerEvents="box-none" style={[styles.phoneWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.phoneBar}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name]
          if (!tab) return null
          const current = state.index === index
          const Icon = tab.icon
          return (
            <Focusable
              key={route.key}
              onPress={() => go(route.name, route.key, current)}
              radius={radius.pill}
              containerStyle={styles.phoneSlot}
              accessibilityRole="tab"
              accessibilityState={{ selected: current }}
              accessibilityLabel={t(tab.label)}
              style={[styles.phoneTab, current && styles.phoneTabOn]}
            >
              <Icon size={22} color={current ? colors.white : colors.text3} strokeWidth={current ? 2.2 : 1.9} />
              <Text weight={current ? 'semibold' : 'medium'} size={11} tone={current ? 'primary' : 'tertiary'} numberOfLines={1}>{t(tab.label)}</Text>
            </Focusable>
          )
        })}
      </View>
    </View>
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
  phoneTabOn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  tvBar: {
    position: 'absolute',
    top: 28,
    start: space.page,
    end: space.page,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 76,
    paddingHorizontal: 14,
    borderRadius: 38,
    backgroundColor: 'rgba(18,18,18,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tvLogo: { paddingHorizontal: 18 },
  tvTab: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 22, borderRadius: 28 },
  tvTabFocused: { backgroundColor: colors.white },
  tvLine: { position: 'absolute', start: 24, end: 24, bottom: 4, height: 3, borderRadius: 2, backgroundColor: colors.red },
})
