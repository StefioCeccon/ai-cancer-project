import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider_Interface, AIRequestOptions, AIResponse } from "../types";
import { resolveProviderKey } from "../keys";

export class AnthropicProvider implements AIProvider_Interface {
  name = "anthropic" as const;

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    const apiKey = options.apiKey ?? (await resolveProviderKey("anthropic"));
    if (!apiKey) throw new Error("No Anthropic API key configured");
    const client = new Anthropic({ apiKey });
    const systemMsg = options.messages.find((m) => m.role === "system")?.content;
    const userMessages = options.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 8192,
      temperature: options.temperature ?? 0.3,
      system: systemMsg,
      messages: userMessages,
    });

    const content = response.content[0];
    return {
      content: content.type === "text" ? content.text : "",
      provider: "anthropic",
      model: options.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
