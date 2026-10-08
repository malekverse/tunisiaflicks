// A deadline for optional work: home rows and other extras must never hold a page hostage.

/**
 * Resolves with what `p` gives within `ms`, otherwise with `fallback`. It never rejects: a failure
 * also gives the fallback (and is logged), so `await withTimeout(getRow(), 4000, null)` is always
 * safe to render. The work itself isn't cancelled; its late result is simply ignored.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    p.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        console.error('withTimeout: the task failed, using the fallback', error)
        resolve(fallback)
      },
    )
  })
}
