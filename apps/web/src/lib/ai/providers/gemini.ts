import { GoogleGenAI } from "@google/genai";
import type { AIProvider_Interface, AIRequestOptions, AIResponse } from "../types";
import { resolveProviderKey } from "../keys";

export class GeminiProvider implements AIProvider_Interface {
  name = "gemini" as const;

  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    const apiKey = options.apiKey ?? (await resolveProviderKey("gemini"));
    if (!apiKey) throw new Error("No Gemini API key configured");
    const client = new GoogleGenAI({ apiKey });
    const systemMsg = options.messages.find((m) => m.role === "system");
    const userMessages = options.messages.filter((m) => m.role !== "system");

    // Map conversation into genai `contents` (user/model turns).
    const contents = userMessages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const response = await client.models.generateContent({
      model: options.model,
      contents,
      config: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxTokens ?? 8192,
        // Disable "thinking" so the entire output budget goes to the answer.
        // On 2.5 Flash thinking tokens otherwise consume maxOutputTokens and
        // truncate the response mid-sentence (finishReason MAX_TOKENS).
        thinkingConfig: { thinkingBudget: 0 },
        ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
        ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason ?? "unknown";
    const content = response.text ?? "";

    if (!content) {
      throw new Error(`Gemini returned no text (finishReason: ${finishReason})`);
    }

    // Diagnostic: surface truncation (MAX_TOKENS), safety blocks, and budget usage.
    const outTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
    const inTokens = response.usageMetadata?.promptTokenCount ?? 0;
    if (finishReason !== "STOP") {
      console.warn(
        `[Gemini] finishReason=${finishReason} maxTokens=${options.maxTokens ?? 8192} ` +
          `outTokens=${outTokens} inTokens=${inTokens} contentChars=${content.length} ` +
          `— response was likely TRUNCATED`,
      );
    } else {
      console.log(
        `[Gemini] finishReason=STOP outTokens=${outTokens} inTokens=${inTokens} contentChars=${content.length}`,
      );
    }

    return {
      content,
      provider: "gemini",
      model: options.model,
      usage: {
        inputTokens: inTokens,
        outputTokens: outTokens,
      },
    };
  }
}
