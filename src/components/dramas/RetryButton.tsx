"use client"
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCw } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { cn } from '@/src/lib/utils'

/** Asks the server for the page again (TMDB may be back), without a full reload. */
export default function RetryButton({ label }: { label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button size="lg" variant="secondary" disabled={pending} onClick={() => start(() => router.refresh())}>
      <RotateCw aria-hidden className={cn('h-[18px] w-[18px]', pending && 'animate-spin')} />
      {label}
    </Button>
  )
}
