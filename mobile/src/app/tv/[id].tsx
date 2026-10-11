// A link to the site's page for a show (https://tunisiaflicks.vercel.app/tv/123) opens it in the app.
import { Redirect, useLocalSearchParams } from 'expo-router'

export default function TvLink() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const tmdb = /^\d+/.exec(id ?? '')?.[0]
  return tmdb ? <Redirect href={{ pathname: '/title/[kind]/[id]', params: { kind: 'tv', id: tmdb } }} /> : <Redirect href="/" />
}
