'use client';

import { useEffect, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Spinner } from '@/src/components/ui/spinner';

function LoaderComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsLoading(true); // Show loader when route changes
    const timeout = setTimeout(() => setIsLoading(false), 500); // Hide loader after 500ms
    return () => clearTimeout(timeout);
  }, [pathname, searchParams]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <Spinner className="h-12 w-12 text-white" />
      <div className="fixed inset-0 bg-transparent" /> {/* Block interaction */}
    </div>
  );
}

export default function Loader() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoaderComponent />
    </Suspense>
  );
}