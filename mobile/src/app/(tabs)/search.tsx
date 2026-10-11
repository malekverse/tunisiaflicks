// Search: one field, results as you type (after a short pause), your recent searches while it's
// empty. Any language: the site searches TMDB's titles in all of them.
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { useIsFocused } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Clock, Search as SearchIcon, SearchX, X } from 'lucide-react-native'
import { useSearch } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useT } from '@/i18n'
import { Grid } from '@/components/media/Grid'
import { Loader } from '@/components/brand/Logo'
import { Focusable } from '@/components/ui/Focusable'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Display, Text } from '@/components/ui/Text'
import { useTabBarSpace } from '@/components/shell/TabBar'
import { colors, fonts, isTV, radius, type } from '@/theme/tokens'

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

export default function SearchScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const bottom = useTabBarSpace()
  const [text, setText] = useState('')
  const q = useDebounced(text, 350).trim()
  const search = useSearch(q)
  const searches = useStore((state) => state.searches)
  const addSearch = useStore((state) => state.addSearch)
  const clearSearches = useStore((state) => state.clearSearches)
  const input = useRef<TextInput>(null)
  const focused = useIsFocused()

  // Remember a search once it has found something.
  useEffect(() => {
    if (q.length >= 2 && search.data?.results.length) addSearch(q)
  }, [q, search.data, addSearch])

  const results = q.length >= 2 ? search.data?.results ?? [] : []

  const field = (
    <View style={styles.fieldWrap}>
      {isTV ? null : <Display size={type.pageTitle} style={{ marginBottom: 14 }} accessibilityRole="header">{t('nav.search')}</Display>}
      <View style={styles.field}>
        <SearchIcon color={colors.text3} size={isTV ? 26 : 20} />
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.text3}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          selectionColor={colors.red}
          cursorColor={colors.red}
          onSubmitEditing={() => addSearch(text)}
          autoFocus={focused && !isTV && searches.length === 0}
          accessibilityLabel={t('nav.search')}
        />
        {text ? (
          <Focusable onPress={() => { setText(''); input.current?.focus() }} radius={16} accessibilityRole="button" accessibilityLabel={t('search.clear')} style={styles.clear}>
            <X color={colors.text2} size={isTV ? 24 : 18} />
          </Focusable>
        ) : null}
      </View>
    </View>
  )

  let body: React.ReactElement | null = null
  if (q.length < 2) {
    body = searches.length ? (
      <View style={styles.recent}>
        <View style={styles.recentHead}>
          <Text weight="semibold" size={isTV ? 22 : 16}>{t('search.recent')}</Text>
          <Focusable onPress={clearSearches} radius={14} style={{ padding: 6 }} accessibilityRole="button">
            <Text tone="secondary" size={isTV ? 18 : 13.5}>{t('search.clear')}</Text>
          </Focusable>
        </View>
        {searches.map((s) => (
          <Focusable key={s} onPress={() => setText(s)} radius={radius.tile} style={styles.recentItem} accessibilityRole="button">
            <Clock color={colors.text3} size={isTV ? 22 : 17} />
            <Text size={isTV ? 20 : 15} numberOfLines={1} style={{ flex: 1 }}>{s}</Text>
          </Focusable>
        ))}
      </View>
    ) : (
      <EmptyState icon={<SearchIcon color={colors.text2} size={30} />} title={t('nav.search')} text={t('search.hint')} />
    )
  } else if (search.isPending) {
    body = <Loader />
  } else if (search.isError && !search.data) {
    body = <ErrorState error={search.error} onRetry={() => search.refetch()} />
  } else if (results.length === 0) {
    body = <EmptyState icon={<SearchX color={colors.text2} size={30} />} title={t('search.empty', { q })} text={t('search.emptyText')} />
  }

  return (
    <View style={styles.page}>
      <Grid
        items={body ? [] : results}
        header={field}
        empty={body}
        top={isTV ? 140 : insets.top + 12}
        bottom={bottom + 24}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  fieldWrap: { marginBottom: 20 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: isTV ? 66 : 50,
    paddingHorizontal: isTV ? 22 : 16,
    borderRadius: radius.pill,
    backgroundColor: colors.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  input: { flex: 1, color: colors.white, fontFamily: fonts.text, fontSize: isTV ? 22 : 16, paddingVertical: 0, textAlign: 'auto' },
  clear: { padding: 6 },
  recent: { gap: 4 },
  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  recentItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: isTV ? 14 : 11, paddingHorizontal: 4 },
})
