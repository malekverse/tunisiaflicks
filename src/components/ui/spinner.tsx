import { cn } from '@/src/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full h-8 w-8 border-b-2 border-white',
        className
      )}
    />
  );
}