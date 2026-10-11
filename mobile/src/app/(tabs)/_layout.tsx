// The five places: Home, Discover, Search, My List, You (the tab bar: components/shell/TabBar).
import { Tabs } from 'expo-router'
import { TabBar } from '@/components/shell/TabBar'
import { colors, isTV } from '@/theme/tokens'

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.black },
        // TV: the bar floats over the top of the page; phones: over the bottom.
        tabBarPosition: isTV ? 'top' : 'bottom',
        animation: 'fade',
        lazy: true,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="you" />
    </Tabs>
  )
}
