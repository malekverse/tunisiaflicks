// The network address a guest's limits count (pure, for the tests): an IPv4 address as is, an
// IPv6 address by its /64 network, since one home or one phone gets a whole /64 and can hop
// through it at will.

/** The address a limit counts: IPv4 as is, IPv6 by its /64 network (one home or phone gets many). */
export function ipKey(ip: string): string {
  const value = (ip || 'unknown').trim().toLowerCase()
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value)
  if (mapped) return mapped[1]
  if (!value.includes(':')) return value
  const [head, tail = ''] = value.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = value.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, '') || '0').join(':')}::/64`
}
