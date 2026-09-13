import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, patients, analysisRuns } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/user";
import { getProvider } from "@/lib/ai/registry";
import { resolveProviderKey } from "@/lib/ai/keys";
import { SPECIALIST_SYSTEM_PROMPTS, buildOncologistChatPrompt } from "@/lib/ai/prompts";
import type { AIProvider, MDTConsultationResult } from "@cancer-monitor/shared";

const schema = z.object({
  patientId:   z.string().uuid(),
  runId:       z.string().uuid(),
  provider:    z.enum(["gemini", "openai", "anthropic", "mistral"]),
  model:       z.string().min(1),
  question:    z.string().min(1).max(1000),
  chatHistory: z.array(z.object({
    question: z.string(),
    answer:   z.string(),
  })).optional(),
});

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { patientId, runId, provider, model, question, chatHistory = [] } = parsed.data;

  try {
    const [[patient], [run]] = await Promise.all([
      db.select().from(patients).where(and(eq(patients.id, patientId), eq(patients.userId, userId))),
      db.select().from(analysisRuns).where(and(eq(analysisRuns.id, runId), eq(analysisRuns.userId, userId))),
    ]);

    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });
    if (!run?.result) return Response.json({ error: "Consultation not found" }, { status: 404 });

    const result = run.result as unknown as MDTConsultationResult;

    const patientContext = [
      `Patient: ${patient.firstName} ${patient.lastName}`,
      patient.cancerType  ? `Cancer type: ${patient.cancerType}`   : null,
      patient.cancerStage ? `Stage: ${patient.cancerStage}`        : null,
    ].filter(Boolean).join("\n");

    const aiProvider = getProvider(provider as AIProvider);
    const apiKey = await resolveProviderKey(provider as AIProvider, userId);
    if (!apiKey) return Response.json({ error: `No API key configured for ${provider}. Add one in Settings.` }, { status: 400 });

    const prompt = buildOncologistChatPrompt({
      patientContext,
      synthesisReport: result.synthesis?.report ?? "",
      chatHistory,
      newQuestion: question,
    });

    const response = await aiProvider.chat({
      provider: provider as AIProvider,
      model,
      apiKey,
      temperature: 0.3,
      maxTokens: 1500,
      messages: [
        { role: "system", content: SPECIALIST_SYSTEM_PROMPTS.oncologist },
        { role: "user",   content: prompt },
      ],
    });

    return Response.json({ answer: response.content, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
