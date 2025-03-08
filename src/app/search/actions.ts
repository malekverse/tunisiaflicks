'use server'

import { revalidatePath } from 'next/cache'

export async function searchMovies(query: string, adult: boolean = false, page: number = 1) {
  const key = process.env.TMDB_API_KEY

  if (!key) {
    throw new Error('TMDB API key is not set')
  }

  const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&language=en-US&query=${encodeURIComponent(query)}&page=${page}&include_adult=${adult}`

  try {
    const response = await fetch(url, { next: { revalidate: 60 } })

    if (!response.ok) {
      throw new Error('Failed to fetch data')
    }

    const data = await response.json()

    // Revalidate the search results page
    revalidatePath('/search')

    return data
  } catch (error) {
    console.error('Error fetching search results:', error)
    throw error
  }
}

