// You: the language, Kids mode, the app's version (and the update when there's one: it downloads
// from the site, like the first install), the website and privacy, and clearing the watch history.
import { BackHandler, I18nManager, Linking, ScrollView, StyleSheet, View } from 'react-native'
import * as Application from 'expo-application'
import * as WebBrowser from 'expo-web-browser'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, ChevronRight, Download, Globe, History, Languages, Shield, Smile, type LucideIcon } from 'lucide-react-native'
import { SITE, useVersion } from '@/lib/api'
import { useStore } from '@/lib/store'
import { LOCALES, directionMismatch, isRtl, useIsArabic, useT, type Locale } from '@/i18n'
import { LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Focusable } from '@/components/ui/Focusable'
import { Display, Text } from '@/components/ui/Text'
import { RoomLight } from '@/components/ui/RoomLight'
import { useTabBarSpace } from '@/components/shell/TabBar'
import { confirm } from '@/components/motion/Confirm'
import { colors, isTV, radius, space, type } from '@/theme/tokens'
import { translate } from '@/i18n/strings'
import { newer } from '@/lib/version'

export default function YouScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const bottom = useTabBarSpace()
  const arabic = useIsArabic()
  const locale = useStore((state) => state.locale)
  const setLocale = useStore((state) => state.setLocale)
  const kids = useStore((state) => state.kids)
  const setKids = useStore((state) => state.setKids)
  const clearHistory = useStore((state) => state.clearHistory)
  const hasHistory = useStore((state) => state.history.length > 0)
  const version = useVersion()
  const current = Application.nativeApplicationVersion ?? '2.0.0'
  const latest = version.data?.version
  const download = isTV ? version.data?.tv : version.data?.android
  const update = latest && download && newer(latest, current) ? latest : null

  const chooseLanguage = async (next: Locale) => {
    if (next === locale) return
    setLocale(next)
    if (!directionMismatch(next)) return
    // Android lays the app out right to left (or back) only when it starts.
    I18nManager.allowRTL(true)
    I18nManager.forceRTL(isRtl(next))
    const name = LOCALES.find((l) => l.id === next)?.name ?? next
    const close = await confirm({
      title: translate(next, 'you.restartTitle'),
      text: translate(next, 'you.restartText', { language: name }),
      ok: translate(next, 'you.restartNow'),
      cancel: translate(next, 'common.cancel'),
      icon: <Languages color={colors.white} size={26} />,
    })
    // A moment for the choice to be saved before the app closes.
    if (close) setTimeout(() => BackHandler.exitApp(), 300)
  }

  const confirmClear = async () => {
    if (await confirm({ title: t('you.clearHistory'), ok: t('search.clear'), cancel: t('common.cancel'), destructive: true, icon: <History color={colors.white} size={26} /> })) clearHistory()
  }

  const chevron = <ChevronRight color={colors.text3} size={isTV ? 24 : 18} style={arabic ? { transform: [{ scaleX: -1 }] } : undefined} />

  return (
    <View style={styles.page}>
      <RoomLight />
      <ScrollView contentContainerStyle={{ paddingTop: isTV ? 140 : insets.top + 12, paddingBottom: bottom + 24, paddingHorizontal: space.page }} showsVerticalScrollIndicator={false}>
        <View style={isTV ? styles.tvColumns : undefined}>
          <View style={isTV ? { flex: 1 } : undefined}>
            {isTV ? null : <Display size={type.pageTitle} style={{ marginBottom: 18 }} accessibilityRole="header">{t('you.title')}</Display>}

            {update ? (
              <View style={styles.update}>
                <Download color={colors.white} size={isTV ? 28 : 22} />
                <Text weight="semibold" size={isTV ? 20 : 15} style={{ flex: 1 }}>{t('you.update', { version: update })}</Text>
                <Button label={t('you.updateNow')} onPress={() => Linking.openURL(`${SITE}/download/${isTV ? 'tv' : 'android'}`)} hasTVPreferredFocus />
              </View>
            ) : null}

            <Group title={t('you.language')}>
              {LOCALES.map((l, i) => (
                <Item
                  key={l.id}
                  first={i === 0}
                  onPress={() => chooseLanguage(l.id)}
                  label={l.name}
                  selected={l.id === locale}
                  hasTVPreferredFocus={!update && i === 0}
                  right={l.id === locale ? <Check color={colors.red} size={isTV ? 26 : 20} strokeWidth={2.6} /> : null}
                />
              ))}
            </Group>
          </View>

          <View style={isTV ? { flex: 1 } : undefined}>
            <Group title={t('you.kids')}>
              <Item
                first
                onPress={() => setKids(!kids)}
                icon={Smile}
                label={t('you.kids')}
                sub={t('you.kidsText')}
                selected={kids}
                role="switch"
                right={<Toggle on={kids} />}
              />
            </Group>

            <Group title="TunisiaFlicks">
              {isTV ? null : <Item first onPress={() => Linking.openURL(SITE)} icon={Globe} label={t('you.website')} right={chevron} />}
              {isTV ? null : <Item onPress={() => WebBrowser.openBrowserAsync(`${SITE}/privacy`, { toolbarColor: '#000000' })} icon={Shield} label={t('you.privacy')} right={chevron} />}
              <Item first={isTV} onPress={confirmClear} disabled={!hasHistory} icon={History} label={t('you.clearHistory')} />
            </Group>

            <View style={styles.about}>
              <LogoMark size={isTV ? 30 : 22} />
              <Text tone="tertiary" size={isTV ? 18 : 13}>{t('you.version', { version: current })}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

function Group({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text tone="tertiary" weight="semibold" size={isTV ? 17 : 12.5} style={styles.groupTitle}>{title.toUpperCase()}</Text>
      <View style={styles.panel}>{children}</View>
    </View>
  )
}

type ItemProps = {
  label: string
  sub?: string
  icon?: LucideIcon
  right?: React.ReactNode
  onPress: () => void
  first?: boolean
  selected?: boolean
  disabled?: boolean
  hasTVPreferredFocus?: boolean
  role?: 'button' | 'switch' | 'radio'
}

function Item({ label, sub, icon: Icon, right, onPress, first, selected, disabled, hasTVPreferredFocus, role = 'button' }: ItemProps) {
  return (
    <Focusable
      onPress={onPress}
      disabled={disabled}
      plain
      focusScale={1.02}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityRole={role}
      accessibilityState={role === 'switch' ? { checked: selected } : { selected }}
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
    >
      {({ focused }) => (
        <View style={[styles.item, !first && styles.itemLine, focused && styles.itemFocused, disabled && { opacity: 0.45 }]}>
          {Icon ? <Icon color={focused ? colors.black : colors.text2} size={isTV ? 26 : 20} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="medium" size={isTV ? 21 : 15.5} style={focused ? { color: colors.black } : undefined}>{label}</Text>
            {sub ? <Text tone="tertiary" size={isTV ? 16 : 12.5} style={focused ? { color: 'rgba(0,0,0,0.6)' } : undefined}>{sub}</Text> : null}
          </View>
          {right}
        </View>
      )}
    </Focusable>
  )
}

function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, on && styles.toggleOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  tvColumns: { flexDirection: 'row', gap: 40, alignItems: 'flex-start' },
  update: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: isTV ? 20 : 14,
    paddingStart: isTV ? 22 : 16,
    borderRadius: radius.panel,
    backgroundColor: 'rgba(229,15,5,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,36,20,0.35)',
    marginBottom: 22,
  },
  group: { marginBottom: 24 },
  groupTitle: { letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  panel: { borderRadius: radius.panel, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: isTV ? 72 : 56, paddingHorizontal: isTV ? 22 : 16, paddingVertical: 10 },
  itemLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  itemFocused: { backgroundColor: colors.white },
  toggle: { width: isTV ? 58 : 46, height: isTV ? 32 : 26, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.redDeep },
  knob: { width: isTV ? 26 : 20, height: isTV ? 26 : 20, borderRadius: 13, backgroundColor: colors.white },
  knobOn: { alignSelf: 'flex-end' },
  about: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, opacity: 0.9 },
})
