import Link from 'next/link'
import { KidsBadge } from './ProfileAvatar'

/** Shown instead of a title (or section) that a Kids profile can't watch. */
export default function KidsBlocked({ what = 'This title' }: { what?: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <KidsBadge className="text-xs" />
      <h1 className="text-2xl font-bold sm:text-3xl">{what} isn&apos;t available on Kids profiles</h1>
      <p className="max-w-md text-gray-400">Kids profiles only show movies rated G or PG and TV made for kids.</p>
      <div className="mt-4 flex gap-4 text-sm">
        <Link href="/" className="rounded-xl bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600">Back to home</Link>
        <Link href="/profiles" className="rounded-xl bg-zinc-800 px-4 py-2 font-medium text-gray-300 hover:bg-zinc-600 hover:text-white">Switch profile</Link>
      </div>
    </div>
  )
}
