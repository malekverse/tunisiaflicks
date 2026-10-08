// Stand-in for 'next/headers' in unit tests: a request with no cookies and no headers.
const emptyCookies = {
  get: () => undefined,
  getAll: () => [],
  has: () => false,
  set: () => {},
  delete: () => {},
  toString: () => '',
  [Symbol.iterator]: function* () {},
  size: 0,
}

export const cookies = () => emptyCookies
export const headers = () => new Headers()
export const draftMode = () => ({ isEnabled: false, enable: () => {}, disable: () => {} })
