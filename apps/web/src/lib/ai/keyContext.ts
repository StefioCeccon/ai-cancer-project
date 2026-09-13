import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped storage carrying the authenticated internal user id through the
 * AI call stack, so deep helpers (provider clients, upload parsers, MDT
 * orchestration) can resolve per-user API keys without threading `userId` through
 * every function signature.
 *
 * Wrap an AI-invoking route's logic in `runWithUserKeys(userId, fn)`. When no
 * context is set, key resolution falls back to env vars (preserving local/dev and
 * any non-request callers).
 */
const store = new AsyncLocalStorage<{ userId: string | null }>();

export function runWithUserKeys<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  return store.run({ userId }, fn);
}

export function getContextUserId(): string | null {
  return store.getStore()?.userId ?? null;
}
