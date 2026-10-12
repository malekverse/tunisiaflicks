// The app's frame: the fonts (the site's Readex Pro, Alexandria, and the condensed display face),
// data caching, gestures, and the screen stack. The splash screen stays until the fonts and the
// saved settings are ready, so the first frame is already the real one.
import { useCallback, useEffect, useState } from 'react'
import { I18nManager, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useFonts } from 'expo-font'
import { ReadexPro_400Regular, ReadexPro_500Medium, ReadexPro_600SemiBold, ReadexPro_700Bold } from '@expo-google-fonts/readex-pro'
import { Alexandria_700Bold, Alexandria_800ExtraBold } from '@expo-google-fonts/alexandria'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useStore } from '@/lib/store'
import { isRtl } from '@/i18n'
import { Intro } from '@/components/motion/Intro'
import { ToastHost } from '@/components/motion/Toast'
import { ConfirmHost } from '@/components/motion/Confirm'
import { PeekHost } from '@/components/media/Peek'
import { colors } from '@/theme/tokens'

// A title opened from a link to the site still has Home under it: Back goes there, not out of the app.
export const unstable_settings = { initialRouteName: '(tabs)' }

SplashScreen.preventAutoHideAsync().catch(() => {})
// No fade: the intro takes over from the splash screen's A exactly where it is.
SplashScreen.setOptions({ fade: false })
SystemUI.setBackgroundColorAsync(colors.black).catch(() => {})

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 60 * 60_000, refetchOnWindowFocus: false } },
})

function useHydrated() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated())
  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), [])
  return hydrated
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ReadexPro_400Regular,
    ReadexPro_500Medium,
    ReadexPro_600SemiBold,
    ReadexPro_700Bold,
    Alexandria_700Bold,
    Alexandria_800ExtraBold,
    'TFDisplay-Bold': require('../../assets/fonts/TFDisplay-Bold.ttf'),
    'TFDisplay-ExtraBold': require('../../assets/fonts/TFDisplay-ExtraBold.ttf'),
  })
  const hydrated = useHydrated()
  const ready = fontsLoaded && hydrated
  const [intro, setIntro] = useState(true)
  const [splashGone, setSplashGone] = useState(false)
  const introDone = useCallback(() => setIntro(false), [])

  useEffect(() => {
    if (!ready) return
    SplashScreen.hideAsync().catch(() => {}).finally(() => setSplashGone(true))
    // The direction the next launch lays out in follows the chosen language (Android applies it at launch).
    I18nManager.allowRTL(true)
    I18nManager.forceRTL(isRtl(useStore.getState().locale))
  }, [ready])

  if (!ready) return null
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.black }, animation: 'fade_from_bottom' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="title/[kind]/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="list/[key]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="watch" options={{ presentation: 'fullScreenModal', animation: 'fade', orientation: 'landscape' }} />
            <Stack.Screen name="trailer" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="movie/[id]" options={{ animation: 'none' }} />
            <Stack.Screen name="tv/[id]" options={{ animation: 'none' }} />
          </Stack>
          <PeekHost />
          <ToastHost />
          <ConfirmHost />
          {intro ? <Intro start={splashGone} onDone={introDone} /> : null}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
})
