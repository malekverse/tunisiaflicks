// Secrets that ride in URLs (invite tokens, unsubscribe and pairing codes, share keys) must not end
// up in error reports or in the Referer header. Used by the Sentry setup (server, edge, browser).

/** Query parameters that carry a secret: ?invite=, ?t= (signed links), ?code=, ?device=, ?k= (share key). */
export const SECRET_PARAMS: ReadonlySet<string> = new Set(['invite', 't', 'code', 'device', 'k'])

const decode = (value: string) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

/**
 * A parameter that is itself a return address (?next=/u/x%3Finvite%3Dabc, ?callbackUrl=...) is
 * scrubbed too.
 */
function scrubPair(pair: string): string {
  const at = pair.indexOf('=')
  if (at < 0) return pair
  const value = decode(pair.slice(at + 1))
  if (!value.includes('?')) return pair
  const clean = scrubUrl(value)
  return clean === value ? pair : `${pair.slice(0, at)}=${encodeURIComponent(clean)}`
}

/** A query string ('a=1&invite=x', with or without '?') without the secret parameters. */
export function scrubQuery(query: string): string {
  if (typeof query !== 'string') return query
  return query
    .replace(/^\?/, '')
    .split('&')
    .filter((pair) => pair && !SECRET_PARAMS.has(decode(pair.split('=')[0])))
    .map(scrubPair)
    .join('&')
}

/**
 * The URL without its secret parameters, otherwise exactly as given (absolute or relative, other
 * parameters and the #hash untouched): '/u/amine?invite=abc&tab=x' -> '/u/amine?tab=x'.
 */
export function scrubUrl(url: string): string {
  if (typeof url !== 'string') return url
  const hashAt = url.indexOf('#')
  const head = hashAt >= 0 ? url.slice(0, hashAt) : url
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const queryAt = head.indexOf('?')
  if (queryAt < 0) return url
  const query = scrubQuery(head.slice(queryAt + 1))
  return head.slice(0, queryAt) + (query ? `?${query}` : '') + hash
}

/** Free text that may quote a URL (an error message): secret values become [Filtered]. */
export function scrubText(text: string): string {
  if (typeof text !== 'string') return text
  return text
    .replace(/([?&](?:invite|t|code|device|k)=)[^&#\s"'<>]*/g, '$1[Filtered]')
    // The same inside an encoded return address (?next=%2Fu%2Fx%3Finvite%3Dabc).
    .replace(/((?:%3F|%26)(?:invite|t|code|device|k)%3D)(?:(?!%26|%23|[&#\s"'<>]).)*/gi, '$1[Filtered]')
}

type Loose = Record<string, any>

function scrubQueryValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubQuery(value)
  if (Array.isArray(value)) return value.filter((pair) => !(Array.isArray(pair) && SECRET_PARAMS.has(String(pair[0]))))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([name]) => !SECRET_PARAMS.has(name)))
  }
  return value
}

/**
 * Sentry `beforeBreadcrumb`: navigation from/to and fetch/xhr URLs lose their secrets, and so does
 * the query the server SDK keeps beside a sanitized URL (data['http.query'] / data['url.query']).
 */
export function scrubBreadcrumb<B extends Loose>(breadcrumb: B): B {
  const data = breadcrumb.data
  if (data && typeof data === 'object') {
    for (const field of ['url', 'from', 'to']) {
      if (typeof data[field] === 'string') data[field] = scrubUrl(data[field])
    }
    for (const field of Object.keys(data)) {
      if (field.endsWith('.query') && typeof data[field] === 'string') data[field] = scrubQuery(data[field])
    }
  }
  if (typeof breadcrumb.message === 'string') (breadcrumb as Loose).message = scrubText(breadcrumb.message)
  return breadcrumb
}

/**
 * Sentry `beforeSend`: the request URL, query string, Referer, messages, stack frame file names (an
 * inline script's frame is the page address itself) and breadcrumbs.
 */
export function scrubEvent<E extends Loose>(event: E): E {
  const request = event.request
  if (request && typeof request === 'object') {
    if (typeof request.url === 'string') request.url = scrubUrl(request.url)
    if (request.query_string !== undefined) request.query_string = scrubQueryValue(request.query_string)
    const headers = request.headers
    if (headers && typeof headers === 'object') {
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === 'referer' && typeof headers[name] === 'string') headers[name] = scrubUrl(headers[name])
      }
    }
  }
  if (typeof event.message === 'string') (event as Loose).message = scrubText(event.message)
  for (const exception of event.exception?.values ?? []) {
    if (typeof exception?.value === 'string') exception.value = scrubText(exception.value)
    for (const frame of exception?.stacktrace?.frames ?? []) {
      if (typeof frame?.filename === 'string') frame.filename = scrubUrl(frame.filename)
      if (typeof frame?.abs_path === 'string') frame.abs_path = scrubUrl(frame.abs_path)
    }
  }
  const breadcrumbs = Array.isArray(event.breadcrumbs) ? event.breadcrumbs : event.breadcrumbs?.values
  if (Array.isArray(breadcrumbs)) breadcrumbs.forEach((breadcrumb: Loose) => scrubBreadcrumb(breadcrumb))
  return event
}
