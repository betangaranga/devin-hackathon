import type { TopicKey, TopicMeta } from '../types'

const modules = import.meta.glob<{ default: TopicMeta }>('./*.ts', { eager: true })

export const TOPICS: TopicMeta[] = Object.entries(modules)
  .filter(([path]) => !path.endsWith('/index.ts'))
  .map(([, m]) => m.default)
  .sort((a, b) => a.order - b.order)

export const TOPIC_BY_KEY = Object.fromEntries(TOPICS.map((t) => [t.key, t])) as Record<TopicKey, TopicMeta>
export const SCORED_TOPICS = TOPICS.filter((t) => t.scored)
