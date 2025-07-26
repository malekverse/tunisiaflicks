import { Suspense } from "react";
import EpisodesContent from "./episodes-content";

// Server component that uses Suspense to wrap the client component
export default function EpisodesPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Loading episodes...</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-[250px] w-full rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <EpisodesContent />
    </Suspense>
  );
}
