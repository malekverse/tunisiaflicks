// Shared between the contact form (client) and /api/contact (server).
export const CONTACT_TOPICS = ['general', 'bug', 'idea', 'account', 'other'] as const
export type ContactTopic = (typeof CONTACT_TOPICS)[number]
