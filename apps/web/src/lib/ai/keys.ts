import { and, eq } from "drizzle-orm";
import type { AIProvider } from "@ai-cancer-project/shared";
import { db, apiKeys } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getContextUserId } from "./keyContext";

export const PROVIDER_ENV_VARS: Record<AIProvider, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  mistral: "MISTRAL_API_KEY",
};

export const ALL_PROVIDERS: AIProvider[] = ["gemini", "openai", "anthropic", "mistral"];

function envKey(provider: AIProvider): string | null {
  return process.env[PROVIDER_ENV_VARS[provider]] || null;
}

/**
 * Resolve the API key for a provider: the current user's saved key (decrypted)
 * takes precedence, falling back to the server env var. `userId` defaults to the
 * request-scoped context (see keyContext).
 */
export async function resolveProviderKey(
  provider: AIProvider,
  userId?: string | null,
): Promise<string | null> {
  const uid = userId ?? getContextUserId();
  if (uid) {
    try {
      const row = await db.query.apiKeys.findFirst({
        where: and(eq(apiKeys.userId, uid), eq(apiKeys.provider, provider)),
      });
      if (row?.encryptedKey) return decryptSecret(row.encryptedKey);
    } catch {
      // Decrypt/db failure → fall back to env so the app keeps working.
    }
  }
  return envKey(provider);
}

/**
 * Providers usable by this user: those with a saved key OR a server env key.
 * (Mistral is included for status display even though chat is not implemented yet.)
 */
export async function getConfiguredProvidersForUser(
  userId: string | null,
): Promise<AIProvider[]> {
  const configured = new Set<AIProvider>();
  for (const p of ALL_PROVIDERS) {
    if (envKey(p)) configured.add(p);
  }
  if (userId) {
    try {
      const rows = await db
        .select({ provider: apiKeys.provider })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));
      for (const r of rows) configured.add(r.provider);
    } catch {
      // ignore — fall back to env-configured set
    }
  }
  return ALL_PROVIDERS.filter((p) => configured.has(p));
}

/** Preferred default provider for a user (saved key or env), or throw if none. */
export async function getDefaultProviderForUser(
  userId?: string | null,
): Promise<AIProvider> {
  const configured = await getConfiguredProvidersForUser(userId ?? getContextUserId());
  // mistral has no working chat impl yet — never auto-select it.
  for (const p of ["gemini", "openai", "anthropic"] as AIProvider[]) {
    if (configured.includes(p)) return p;
  }
  throw new Error("No AI provider configured. Add an API key in Settings or set one in .env");
}
