// Turning a dictionary into `t()`. No dictionaries are imported here (types only), so a client
// component can build its translator from the messages the server hands it without bundling every
// language.
import type { TKey } from './en'

export type TVars = Record<string, string | number>
export type Translate = (key: TKey, vars?: TVars) => string

/** Replaces `{name}` placeholders with `vars.name`; unknown placeholders are left as they are. */
export function fillPlaceholders(text: string, vars?: TVars): string {
  return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text
}

/**
 * `t('key', { name })` over `messages`; a key missing there comes from `fallback` (English), and a
 * key missing from both is shown as itself.
 */
export function translatorFrom(messages: Record<string, string>, fallback?: Record<string, string>): Translate {
  return (key, vars) => fillPlaceholders(messages[key] ?? fallback?.[key] ?? key, vars)
}

// Messages the /api/auth/* routes answer with (always English), mapped to dictionary keys.
const API_MESSAGES: Record<string, TKey> = {
  'Email is required': 'api.emailRequired',
  'If your email is registered, you will receive a password reset link': 'api.resetIfRegistered',
  'An error occurred while processing your request': 'api.requestFailed',
  'Token and password are required': 'api.tokenRequired',
  'Invalid or expired reset token': 'api.invalidToken',
  'An error occurred while resetting your password': 'api.resetFailed',
  'Missing required fields': 'api.missingFields',
  'Password must be at least 8 characters': 'api.passwordMin8',
  'User already exists': 'api.userExists',
  'Error creating user': 'api.createFailed',
  'Too many attempts. Please try again later.': 'api.tooManyAttempts',
}

/** Translates a known API message; anything else is returned unchanged. */
export function translateApiMessage(t: Translate, message?: string): string | undefined {
  const key = message ? API_MESSAGES[message] : undefined
  return key ? t(key) : message
}
