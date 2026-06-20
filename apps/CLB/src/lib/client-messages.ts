import type { AbstractIntlMessages } from 'next-intl'

/** Namespace cần cho client components — tránh nhét toàn bộ messages vào bundle. */
const CLIENT_NAMESPACES = ['common', 'nav', 'form'] as const

export function pickClientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  return Object.fromEntries(CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]]))
}
