import { BrandLoader } from '@/src/components/brand/BrandMark';
import { cn } from '@/src/lib/utils';

/** The site's loader (the brand "A", see BrandLoader), at h-8 unless told otherwise. */
export function Spinner({ className }: { className?: string }) {
  return <BrandLoader tone="brand" className={cn('h-8 w-8', className)} />;
}
