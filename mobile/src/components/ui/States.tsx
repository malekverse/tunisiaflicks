// The empty and error states: an icon, a title, one helpful sentence and an action (the site's EmptyState).
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { CloudOff, TriangleAlert } from 'lucide-react-native'
import { ApiError } from '@/lib/api'
import { useT } from '@/i18n'
import { colors, isTV } from '@/theme/tokens'
import { Button } from './Button'
import { Display, Text } from './Text'

export function EmptyState({ icon, title, text, action }: { icon: ReactNode, title: string, text?: string, action?: ReactNode }) {
  return (
    <View style={styles.box}>
      <View style={styles.icon}>{icon}</View>
      <Display size={isTV ? 30 : 22} style={styles.center}>{title}</Display>
      {text ? <Text tone="secondary" style={[styles.center, styles.text]}>{text}</Text> : null}
      {action ? <View style={{ marginTop: 18 }}>{action}</View> : null}
    </View>
  )
}

/** What went wrong (offline, or anything else), with "Try again". */
export function ErrorState({ error, onRetry }: { error: unknown, onRetry?: () => void }) {
  const t = useT()
  const offline = error instanceof ApiError && error.code === 'offline'
  return (
    <EmptyState
      icon={offline ? <CloudOff color={colors.text2} size={30} strokeWidth={1.8} /> : <TriangleAlert color={colors.text2} size={30} strokeWidth={1.8} />}
      title={t('error.title')}
      text={offline ? t('error.offline') : undefined}
      action={onRetry ? <Button label={t('common.retry')} variant="secondary" onPress={onRetry} hasTVPreferredFocus /> : undefined}
    />
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48, minHeight: 280 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chip, marginBottom: 18 },
  center: { textAlign: 'center' },
  text: { marginTop: 8, maxWidth: 420 },
})
