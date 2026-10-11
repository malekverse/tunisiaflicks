// A trailer: YouTube's privacy-enhanced player, full screen, inside a page of ours (YouTube wants to
// know which site embeds it). Nothing else may open from it.
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { StatusBar } from 'expo-status-bar'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { SITE } from '@/lib/api'
import { useT } from '@/i18n'
import { IconButton } from '@/components/ui/Button'
import { colors, isTV } from '@/theme/tokens'

export default function TrailerScreen() {
  const { key } = useLocalSearchParams<{ key: string }>()
  const t = useT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const safeKey = /^[\w-]{6,20}$/.test(key ?? '') ? key : ''

  // Turn the phone sideways and the trailer fills the screen.
  useEffect(() => {
    if (isTV) return
    ScreenOrientation.unlockAsync().catch(() => {})
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}) }
  }, [])

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head>
<body><iframe src="https://www.youtube-nocookie.com/embed/${safeKey}?autoplay=1&playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`

  return (
    <View style={styles.page}>
      <StatusBar hidden />
      <WebView
        source={{ html, baseUrl: SITE }}
        style={styles.page}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request) => request.url.startsWith(SITE) || request.url === 'about:blank'}
        setSupportMultipleWindows={false}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        hasTVPreferredFocus
      />
      {isTV ? null : (
        <View style={[styles.closeSpot, { top: Math.max(insets.top, 12), end: Math.max(insets.right, 12) }]}>
          <IconButton label={t('common.close')} onPress={() => router.back()} icon={<X color={colors.white} size={22} />} style={styles.close} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  closeSpot: { position: 'absolute' },
  close: { backgroundColor: 'rgba(0,0,0,0.5)' },
})
