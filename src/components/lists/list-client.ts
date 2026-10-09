"use client"
// Talking to the lists API from the browser: one fetch helper that turns {error, code} answers into
// a thrown ListApiError, and the words for each error.
import type { Translate } from '@/src/lib/i18n/translate'
import type { TKey } from '@/src/lib/i18n'
import { socialErrorText } from '@/src/components/social/use-social-self'

export class ListApiError extends Error {
  status: number
  code: string
  body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : `HTTP ${status}`)
    this.status = status
    this.code = typeof body.code === 'string' ? body.code : ''
    this.body = body
  }
}

/** JSON in, JSON out; a non-2xx answer throws a ListApiError (204 resolves to null). */
export async function listFetch<T = Record<string, unknown>>(url: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T | null> {
  const response = await fetch(url, {
    method: init?.method ?? 'GET',
    cache: 'no-store',
    signal: init?.signal,
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ListApiError(response.status, body && typeof body === 'object' ? body : {})
  return body as T
}

const CODES: Record<string, TKey> = {
  full: 'sharedLists.errors.full',
  members_full: 'sharedLists.errors.members',
  limit_owned: 'sharedLists.errors.owned',
  limit_joined: 'sharedLists.errors.joined',
  owner_only: 'sharedLists.errors.ownerOnly',
  forbidden: 'sharedLists.errors.forbidden',
  unknown_title: 'sharedLists.errors.unknownTitle',
  owner_leave: 'sharedLists.errors.ownerLeave',
  not_found: 'sharedLists.errors.notFound',
}

/** The words for an error from the lists API (or the social layer's, or the generic one). */
export function listErrorText(t: Translate, error: unknown): string {
  const code = error instanceof ListApiError ? error.code : typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : ''
  if (code && CODES[code]) return t(CODES[code])
  return socialErrorText(t, { code })
}
