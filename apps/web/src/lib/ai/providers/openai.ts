import OpenAI from "openai";
import type { AIProvider_Interface, AIRequestOptions, AIResponse } from "../types";
import { resolveProviderKey } from "../keys";

export class OpenAIProvider implements AIProvider_Interface {
  name = "openai" as const;

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    const apiKey = options.apiKey ?? (await resolveProviderKey("openai"));
    if (!apiKey) throw new Error("No OpenAI API key configured");
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: options.model,
      messages: options.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: options.maxTokens ?? 8192,
      temperature: options.temperature ?? 0.3,
      response_format: options.jsonMode ? { type: "json_object" } : undefined,
    });

    return {
      content: response.choices[0].message.content ?? "",
      provider: "openai",
      model: options.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}
