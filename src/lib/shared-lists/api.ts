// The lists API's answers: JSON that is never cached, and one error shape ({error, code}), the
// same as the social APIs so the client reads both with socialErrorText.
import 'server-only'
import { NextResponse } from 'next/server'
import { MAX_ITEMS, MAX_JOINED, MAX_MEMBERS, MAX_OWNED } from './rules'

export const listJson = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })

export const listError = (status: number, code: string, error?: string, extra?: Record<string, unknown>) =>
  listJson({ error: error ?? code, code, ...extra }, status)

/** Missing, not yours to see, or hidden by a block: always the same answer, so slugs can't be probed. */
export const listNotFound = () => listError(404, 'not_found', 'List not found')
export const unauthorized = () => listError(401, 'unauthorized', 'Unauthorized')
export const kidsOnly = () => listError(403, 'kids', 'Not available on Kids profiles')
export const forbidden = () => listError(403, 'forbidden', 'Only people in this list can change it')
export const ownerOnly = () => listError(403, 'owner_only', 'Only the owner can do this')

export const LIMIT_MESSAGES = {
  owned: `You can have up to ${MAX_OWNED} lists`,
  joined: `You can be in up to ${MAX_JOINED} lists made by others`,
  items: `A list can hold up to ${MAX_ITEMS} titles`,
  members: `A list can have up to ${MAX_MEMBERS} people`,
}
