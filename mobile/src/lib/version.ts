// App versions ("2.1.0"), to tell when the site has a newer build than the one installed.

/** Whether version a is newer than b ("2.1.0" > "2.0.3"). */
export function newer(a: string, b: string) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d > 0
  }
  return false
}
