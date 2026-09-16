import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, apiKeys } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/user";
import { encryptSecret, isEncryptionConfigured } from "@/lib/crypto/secrets";
import { ALL_PROVIDERS, PROVIDER_ENV_VARS } from "@/lib/ai/keys";
import type { AIProvider } from "@ai-cancer-project/shared";

const upsertSchema = z.object({
  provider: z.enum(["gemini", "openai", "anthropic", "mistral"]),
  apiKey: z.string().min(8, "API key looks too short").max(400),
});

const deleteSchema = z.object({
  provider: z.enum(["gemini", "openai", "anthropic", "mistral"]),
});

/** Per-provider key status for the current user (never returns the secret). */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const rows = await db
      .select({
        provider: apiKeys.provider,
        keyHint: apiKeys.keyHint,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));

    type Row = (typeof rows)[number];
    const byProvider = new Map<string, Row>(rows.map((r: Row) => [r.provider, r] as const));

    const data = ALL_PROVIDERS.map((provider: AIProvider) => {
      const saved = byProvider.get(provider);
      return {
        provider,
        hasUserKey: !!saved,
        keyHint: saved?.keyHint ?? null,
        updatedAt: saved?.updatedAt ?? null,
        hasEnvKey: !!process.env[PROVIDER_ENV_VARS[provider]],
      };
    });

    return NextResponse.json({
      success: true,
      data,
      encryptionConfigured: isEncryptionConfigured(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

/** Add or replace the current user's key for a provider. */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        { error: "Server is missing API_KEY_ENCRYPTION_SECRET — cannot store keys securely.", success: false },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input", success: false },
        { status: 400 },
      );
    }

    const { provider, apiKey } = parsed.data;
    const trimmed = apiKey.trim();
    const encryptedKey = encryptSecret(trimmed);
    const keyHint = trimmed.slice(-4);

    await db
      .insert(apiKeys)
      .values({ userId, provider, encryptedKey, keyHint })
      .onConflictDoUpdate({
        target: [apiKeys.userId, apiKeys.provider],
        set: { encryptedKey, keyHint, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true, data: { provider, keyHint } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

/** Remove the current user's key for a provider. */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", success: false }, { status: 400 });
    }

    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, parsed.data.provider)));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
