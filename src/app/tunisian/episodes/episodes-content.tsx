"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import MoviePosterCard from "@/src/components/MoviePosterCard";
import { Skeleton } from "@/src/components/ui/skeleton";

type Episode = {
  title: string;
  link: string;
  image?: string;
};

export default function EpisodesContent() {
  const searchParams = useSearchParams();
  const link = searchParams.get('link');
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (link) {
      fetchEpisodes(link);
    }
  }, [link]);

  const fetchEpisodes = async (link: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/tunisian/get-episodes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ link }),
      });
      const data = await response.json();
      if (data.success) {
        setEpisodes(data.episodes);
        setTitle(data.title || "Episodes");
      } else {
        console.error("Failed to load episodes");
      }
    } catch (error) {
      console.error("Error fetching episodes:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Loading episodes...</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-[250px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mb-6">{title}</h1>
        <p className="text-lg">No episodes found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {episodes.map((episode, index) => (
          <a key={index} href={episode.link} target="_blank" rel="noopener noreferrer" className="block">
            <MoviePosterCard 
              posterImg={episode.image || "/404.png"} 
              title={episode.title} 
              externalImg={!!episode.image}
              voteAverage={null}
              releaseDate={null}
            />
          </a>
        ))}
      </div>
    </div>
  );
}