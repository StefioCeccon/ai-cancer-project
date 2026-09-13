export * from "./types";
export * from "./registry";
export * from "./prompts";

import type { AnalysisResult, AIProvider } from "@cancer-monitor/shared";
import { getProvider } from "./registry";
import { ONCOLOGY_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";
import type { OncologyAnalysisRequest } from "./types";

export async function runOncologyAnalysis(
  request: OncologyAnalysisRequest,
  provider: AIProvider,
  model: string
): Promise<AnalysisResult> {
  const aiProvider = getProvider(provider);
  const userPrompt = buildAnalysisPrompt(request);

  const response = await aiProvider.chat({
    provider,
    model,
    jsonMode: true,
    messages: [
      { role: "system", content: ONCOLOGY_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 8192,
  });

  try {
    const parsed = JSON.parse(response.content) as AnalysisResult;
    return parsed;
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${response.content.slice(0, 200)}`);
  }
}
