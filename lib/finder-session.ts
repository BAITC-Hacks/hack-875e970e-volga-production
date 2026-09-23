import { z } from 'zod';
import type { ChatReply, Query, Result } from './types';

export type ChatTurn = { role: 'user' | 'assistant'; content: string; answerMode?: 'ai' | 'fallback' };
export type FinderSession = {
  query: Query; result: Result | null; initialReply: ChatReply | null;
  chatTurns: ChatTurn[]; chatDraft: string;
};
export const FINDER_SESSION_KEY = 'sobrano:finder:v1';
const querySchema = z.object({
  city: z.string(), date: z.string(), format: z.string(), category: z.string(),
  budget: z.number(), wishes: z.string(), hours: z.number().optional(), language: z.string().optional(),
});
const mode = z.enum(['ai', 'fallback']);
const sessionSchema = z.object({
  version: z.literal(1),
  // An empty budget is serialized as null; keep the unfinished form editable.
  query: querySchema.extend({ budget: z.number().nullable().transform(value => value ?? NaN) }),
  result: z.object({
    status: z.enum(['matched', 'category_absent', 'no_match']), query: querySchema,
    cards: z.array(z.object({
      id: z.string(), anon_name: z.string(), categories: z.array(z.string()), city: z.string(),
      city_imputed: z.boolean(), synthetic: z.boolean(), price_from_kzt: z.number(),
      price_imputed: z.boolean(), event_formats: z.array(z.string()), languages: z.array(z.string()),
      max_hours: z.number().nullable(), description: z.string(), explanation: z.string(),
      evidence: z.string(), checks: z.array(z.string()),
    })),
    total: z.number(), eligible: z.number(),
    excluded: z.object({ busy: z.number(), budget: z.number(), format: z.number(), language: z.number(), hours: z.number() }),
    message: z.string(), ranking: z.enum(['semantic', 'price', 'none']),
    explanationMode: z.enum(['ai', 'facts', 'none']), warnings: z.array(z.string()),
    answer: z.string().optional(), answerMode: mode.optional(),
  }).nullable(),
  initialReply: z.object({ answer: z.string(), answerMode: mode }).nullable(),
  chatTurns: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string(), answerMode: mode.optional() })),
  chatDraft: z.string(),
});

export function readFinderSession(): FinderSession | null {
  try {
    const raw = sessionStorage.getItem(FINDER_SESSION_KEY);
    if (!raw) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveFinderSession(session: FinderSession) {
  try {
    sessionStorage.setItem(FINDER_SESSION_KEY, JSON.stringify({ version: 1, ...session }));
  } catch {
    // Storage can be disabled or full. The current selection must remain usable.
  }
}
