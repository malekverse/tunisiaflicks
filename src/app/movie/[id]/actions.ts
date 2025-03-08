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
            `https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}&append_to_response=images,credits,videos`,
        //   `https://api.themoviedb.org/3/?api_key=${API_KEY}&language=en-US&page=1`,
          { next: { revalidate: 3600 } }
    )


    return res.json()
  } catch (error) {
    console.error("Error fetching movies:", error)
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
            `https://api.themoviedb.org/3/movie/${id}/recommendations?api_key=${API_KEY}`,
        //   `https://api.themoviedb.org/3/movie/{movie_id}/recommendations`,
          { next: { revalidate: 3600 } }
    )


    return res.json()
  } catch (error) {
    console.error("Error fetching similar movies:", error)
    throw error
  }
}