// A link to the site's page for a film (https://tunisiaflicks.vercel.app/movie/123) opens it in the app.
import { Redirect, useLocalSearchParams } from 'expo-router'

export default function MovieLink() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const tmdb = /^\d+/.exec(id ?? '')?.[0]
  return tmdb ? <Redirect href={{ pathname: '/title/[kind]/[id]', params: { kind: 'movie', id: tmdb } }} /> : <Redirect href="/" />
}
