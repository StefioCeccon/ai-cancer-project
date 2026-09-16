import type { AIProvider } from "@ai-cancer-project/shared";
import type { AIProvider_Interface } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";

const providers: Record<AIProvider, AIProvider_Interface> = {
  gemini: new GeminiProvider(),
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  mistral: {
    name: "mistral",
    isConfigured: () => !!process.env.MISTRAL_API_KEY,
    chat: async () => { throw new Error("Mistral provider not yet implemented"); },
  },
};

export function getProvider(name: AIProvider): AIProvider_Interface {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown AI provider: ${name}`);
  return provider;
}

export function getConfiguredProviders(): AIProvider[] {
  return (Object.keys(providers) as AIProvider[]).filter(
    (name) => providers[name].isConfigured()
  );
}

export function getDefaultProvider(): AIProvider {
  if (providers.gemini.isConfigured()) return "gemini";
  if (providers.openai.isConfigured()) return "openai";
  if (providers.anthropic.isConfigured()) return "anthropic";
  throw new Error("No AI provider configured. Set at least one API key in .env");
}
