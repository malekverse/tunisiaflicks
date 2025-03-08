"server";

"use server";

export default async function getMovieData(id: string) {
  const API_KEY = process.env.TMDB_API_KEY
  if (!API_KEY) {
    throw new Error("TMDB_API_KEY is not set")
  }

  try {
    const res = await
        fetch(
            `https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}&append_to_response=images,credits,videos`,
          { next: { revalidate: 3600 } }
    )


    return res.json()
  } catch (error) {
    console.error("Error fetching tv series:", error)
    throw error
  }
}

export async function getSeasonDetails(id: string, season: string) {
  const API_KEY = process.env.TMDB_API_KEY
  if (!API_KEY) {
    throw new Error("TMDB_API_KEY is not set")
  }

  try {
    const res = await
        fetch(
          `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${API_KEY}`,
          { next: { revalidate: 3600 } }
    )


    return res.json()
  } catch (error) {
    console.error("Error fetching season episodes for tv serie:", error)
    throw error
  }
}

export async function getEpisodeDetails(id: string, season: string, episode: string) {
  const API_KEY = process.env.TMDB_API_KEY
  if (!API_KEY) {
    throw new Error("TMDB_API_KEY is not set")
  }

  try {
    const res = await
        fetch(
          `https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}?api_key=${API_KEY}`,
          { next: { revalidate: 3600 } }
    )


    return res.json()
  } catch (error) {
    console.error("Error fetching tv serie episode:", error)
    throw error
  }
}

export async function getSimilarMovieData(id: string) {
  const API_KEY = process.env.TMDB_API_KEY
  if (!API_KEY) {
    throw new Error("TMDB_API_KEY is not set")
  }

  try {
    const res = await
        fetch(
            `https://api.themoviedb.org/3/tv/${id}/recommendations?api_key=${API_KEY}`,
          { next: { revalidate: 3600 } }
    )


    return res.json()
  } catch (error) {
    console.error("Error fetching similar tv series:", error)
    throw error
  }
}