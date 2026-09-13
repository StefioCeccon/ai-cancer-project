"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Key, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type Provider = "gemini" | "openai" | "anthropic" | "mistral";

interface KeyStatus {
  provider: Provider;
  hasUserKey: boolean;
  keyHint: string | null;
  updatedAt: string | null;
  hasEnvKey: boolean;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  mistral: "Mistral",
};

const PROVIDER_HINTS: Record<Provider, string> = {
  gemini: "https://ai.google.dev/",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/",
  mistral: "https://console.mistral.ai/",
};

export function ApiKeysSection() {
  const [statuses, setStatuses] = useState<KeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [encryptionConfigured, setEncryptionConfigured] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/api-keys");
      const data = await res.json();
      setStatuses(data.data ?? []);
      setEncryptionConfigured(data.encryptionConfigured !== false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveKey(provider: Provider) {
    const apiKey = (drafts[provider] ?? "").trim();
    if (!apiKey) return;
    setSavingProvider(provider);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save key");
      }
      setDrafts((d) => ({ ...d, [provider]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save key");
    } finally {
      setSavingProvider(null);
    }
  }

  async function removeKey(provider: Provider) {
    setSavingProvider(provider);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error("Failed to remove key");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove key");
    } finally {
      setSavingProvider(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800">AI Keys</h3>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          Add your own API keys. Keys are encrypted and only used for your account. A
          saved key overrides any server-configured key.
        </p>
      </CardHeader>
      <CardContent>
        {!encryptionConfigured && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Server is missing <code className="font-mono">API_KEY_ENCRYPTION_SECRET</code> — saving keys is disabled until it&apos;s set.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-5">
            {statuses.map((s) => (
              <div key={s.provider} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{PROVIDER_LABELS[s.provider]}</p>
                    {s.hasUserKey ? (
                      <Badge variant="success" className="gap-1">
                        <Check className="w-3 h-3" /> Your key ••••{s.keyHint}
                      </Badge>
                    ) : s.hasEnvKey ? (
                      <Badge variant="info">Server key</Badge>
                    ) : (
                      <Badge variant="neutral">Not set</Badge>
                    )}
                  </div>
                  {s.hasUserKey && (
                    <button
                      type="button"
                      onClick={() => removeKey(s.provider)}
                      disabled={savingProvider === s.provider}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Remove your key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    value={drafts[s.provider] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [s.provider]: e.target.value }))}
                    placeholder={s.hasUserKey ? "Enter a new key to replace" : "Paste API key"}
                    disabled={!encryptionConfigured || savingProvider === s.provider}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <Button
                    size="sm"
                    onClick={() => saveKey(s.provider)}
                    loading={savingProvider === s.provider}
                    disabled={!encryptionConfigured || !(drafts[s.provider] ?? "").trim()}
                  >
                    Save
                  </Button>
                </div>
                <a
                  href={PROVIDER_HINTS[s.provider]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1.5 text-xs text-blue-600 hover:text-blue-700"
                >
                  Get a key →
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
