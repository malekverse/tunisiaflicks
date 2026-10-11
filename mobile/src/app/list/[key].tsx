// "See all": a list's titles as a grid, loading the next page as you near the end.
import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
import { useList } from '@/lib/api'
import { useIsArabic, useT } from '@/i18n'
import { Grid, useGridColumns } from '@/components/media/Grid'
import { Loader } from '@/components/brand/Logo'
import { GridBones } from '@/components/motion/Shimmer'
import { IconButton } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { Display } from '@/components/ui/Text'
import { colors, isTV, type } from '@/theme/tokens'

export default function ListScreen() {
  const { key, title } = useLocalSearchParams<{ key: string, title?: string }>()
  const t = useT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const arabic = useIsArabic()
  const list = useList(key)
  const { columns, cardWidth } = useGridColumns()
  const items = list.data?.pages.flatMap((page) => page.items) ?? []

  const header = (
    <View style={styles.header}>
      {isTV ? null : (
        <IconButton label={t('common.close')} onPress={() => router.back()} icon={<ArrowLeft color={colors.white} size={22} style={arabic ? { transform: [{ scaleX: -1 }] } : undefined} />} />
      )}
      <Display size={isTV ? type.pageTitle : 28} style={{ flex: 1 }} numberOfLines={2} accessibilityRole="header">{title ?? ''}</Display>
    </View>
  )

  return (
    <View style={styles.page}>
      <Grid
        items={items}
        header={header}
        empty={list.isPending ? <GridBones columns={columns} cardWidth={cardWidth} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : null}
        footer={list.isFetchingNextPage ? <Loader size={30} /> : null}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage() }}
        top={isTV ? 48 : insets.top + 8}
        bottom={insets.bottom + 32}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
})
