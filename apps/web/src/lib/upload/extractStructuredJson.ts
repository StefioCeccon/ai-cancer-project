import { GoogleGenerativeAI } from "@google/generative-ai";
import { getProvider } from "@/lib/ai";
import { getDefaultProviderForUser, resolveProviderKey } from "@/lib/ai/keys";
import { parseJsonFromAi } from "./parseJsonFromAi";

interface ExtractStructuredJsonOptions {
  maxChars?: number;
  model?: string;
}

/**
 * Extract structured JSON from document text using the configured AI provider.
 * Uses Gemini generateContent directly when available (same pattern as report parsing).
 */
export async function extractStructuredJson(
  prompt: string,
  documentText: string,
  options?: ExtractStructuredJsonOptions
): Promise<{ data: unknown; rawResponse: string }> {
  const maxChars = options?.maxChars ?? 12000;
  const excerpt =
    documentText.length > maxChars
      ? `${documentText.slice(0, maxChars)}\n\n[... document truncated ...]`
      : documentText;

  const fullPrompt = `${prompt}\n\n---\n\n${excerpt}`;

  const geminiKey = await resolveProviderKey("gemini");
  if (geminiKey) {
    const model = new GoogleGenerativeAI(geminiKey).getGenerativeModel({
      model: options?.model ?? "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 16384,
      },
    });

    const result = await model.generateContent(fullPrompt);
    const response = result.response;

    let rawResponse = "";
    try {
      rawResponse = response.text();
    } catch {
      const finishReason = response.candidates?.[0]?.finishReason ?? "unknown";
      throw new Error(`Gemini returned no text (finishReason: ${finishReason})`);
    }

    return { data: parseJsonFromAi(rawResponse), rawResponse };
  }

  const providerName = await getDefaultProviderForUser();
  const provider = getProvider(providerName);
  const response = await provider.chat({
    provider: providerName,
    model:
      providerName === "openai"
        ? "gpt-4o-mini"
        : "claude-haiku-4-5-20251001",
    jsonMode: true,
    messages: [{ role: "user", content: fullPrompt }],
    temperature: 0,
    maxTokens: 16384,
  });

  if (!response.content?.trim()) {
    throw new Error("AI provider returned empty response");
  }

  return { data: parseJsonFromAi(response.content), rawResponse: response.content };
}
