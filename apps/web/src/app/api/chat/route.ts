import { NextRequest, NextResponse } from "next/server";
import { db, patients, bloodTests, bloodMarkers, medicalReports, analysisRuns, imagingStudies, symptoms, therapies, therapyMedications } from "@/lib/db";
import { and, eq, desc } from "drizzle-orm";
import { getProvider } from "@/lib/ai";
import { getDefaultProviderForUser, resolveProviderKey } from "@/lib/ai/keys";
import { getCurrentUserId } from "@/lib/auth/user";
import type { AIProvider } from "@cancer-monitor/shared";

// Builds a comprehensive context string from all patient data
async function buildPatientContext(patientId: string, userId: string): Promise<string> {
  const [patient] = await db.select().from(patients).where(and(eq(patients.id, patientId), eq(patients.userId, userId))).limit(1);
  if (!patient) throw new Error("Patient not found");

  const lines: string[] = [];

  // ── Demographics ─────────────────────────────────────────────────────────
  lines.push("## Patient Profile");
  lines.push(`Name: ${patient.firstName} ${patient.lastName}`);
  lines.push(`Date of Birth: ${patient.dateOfBirth}`);
  lines.push(`Gender: ${patient.gender}`);
  if (patient.cancerType) lines.push(`Cancer Type: ${patient.cancerType}`);
  if (patient.cancerStage) lines.push(`Stage: ${patient.cancerStage}`);
  if (patient.diagnosisDate) lines.push(`Diagnosis Date: ${patient.diagnosisDate}`);
  if (patient.primaryPhysician) lines.push(`Primary Physician: ${patient.primaryPhysician}`);
  if (patient.notes) lines.push(`Clinical Notes: ${patient.notes}`);

  // ── Blood Tests ───────────────────────────────────────────────────────────
  const tests = await db
    .select()
    .from(bloodTests)
    .where(and(eq(bloodTests.userId, userId), eq(bloodTests.patientId, patientId)))
    .orderBy(desc(bloodTests.testDate))
    .limit(10);

  if (tests.length > 0) {
    lines.push("\n## Blood Test History");
    for (const test of tests) {
      lines.push(`\n### ${test.testDate}${test.labName ? ` (${test.labName})` : ""}`);
      const markers = await db
        .select()
        .from(bloodMarkers)
        .where(eq(bloodMarkers.bloodTestId, test.id));
      for (const m of markers) {
        const range =
          m.referenceMin !== null && m.referenceMax !== null
            ? ` [ref: ${m.referenceMin}–${m.referenceMax} ${m.unit}]`
            : "";
        const flag = m.status !== "normal" ? ` ⚠ ${m.status.replace("_", " ").toUpperCase()}` : "";
        lines.push(`  ${m.name}: ${m.value} ${m.unit}${range}${flag}`);
      }
      if (test.aiInterpretation) {
        lines.push(`  AI Note: ${test.aiInterpretation}`);
      }
    }
  }

  // ── Medical Reports ───────────────────────────────────────────────────────
  const reports = await db
    .select()
    .from(medicalReports)
    .where(and(eq(medicalReports.userId, userId), eq(medicalReports.patientId, patientId)))
    .orderBy(desc(medicalReports.reportDate))
    .limit(10);

  if (reports.length > 0) {
    lines.push("\n## Medical Reports");
    for (const r of reports) {
      lines.push(`\n### ${r.reportDate} — ${r.title} (${r.reportType.replace("_", " ")})`);
      if (r.author) lines.push(`Author: ${r.author}${r.institution ? ` · ${r.institution}` : ""}`);
      if (r.aiSummary) lines.push(`Summary: ${r.aiSummary}`);
      if (r.rawText) {
        // Truncate very long reports to keep context manageable
        const truncated = r.rawText.length > 1500
          ? r.rawText.slice(0, 1500) + "\n[... truncated ...]"
          : r.rawText;
        lines.push(`Full text:\n${truncated}`);
      }
    }
  }

  // ── Imaging ───────────────────────────────────────────────────────────────
  const studies = await db
    .select()
    .from(imagingStudies)
    .where(and(eq(imagingStudies.userId, userId), eq(imagingStudies.patientId, patientId)))
    .orderBy(desc(imagingStudies.studyDate))
    .limit(5);

  if (studies.length > 0) {
    lines.push("\n## Imaging Studies");
    for (const s of studies) {
      lines.push(`\n### ${s.studyDate} — ${s.modality} ${s.bodyPart}`);
      if (s.description) lines.push(`Description: ${s.description}`);
      if (s.radiologistReport) lines.push(`Radiologist Report: ${s.radiologistReport}`);
      if (s.aiFindings) lines.push(`AI Findings: ${s.aiFindings}`);
    }
  }

  // ── Therapies ─────────────────────────────────────────────────────────────
  const therapyRows = await db
    .select()
    .from(therapies)
    .where(and(eq(therapies.userId, userId), eq(therapies.patientId, patientId)))
    .orderBy(desc(therapies.startDate));

  if (therapyRows.length > 0) {
    lines.push("\n## Treatment History");
    for (const t of therapyRows) {
      const status = t.endDate ? `${t.startDate} → ${t.endDate}` : `${t.startDate} → ongoing`;
      lines.push(`\n### ${t.name} (${t.therapyType.replace(/_/g, " ")}) · ${status}`);
      if (t.dosage) lines.push(`  Dosage: ${t.dosage}`);
      if (t.frequency) lines.push(`  Frequency: ${t.frequency}`);
      if (t.notes) lines.push(`  Notes: ${t.notes}`);
      const meds = await db
        .select()
        .from(therapyMedications)
        .where(eq(therapyMedications.therapyId, t.id))
        .orderBy(therapyMedications.startDate);
      if (meds.length > 0) {
        lines.push("  Medications:");
        for (const m of meds) {
          const parts = [m.name, m.dosage, m.frequency, m.route].filter(Boolean).join(" · ");
          const since = m.startDate ? ` (from ${m.startDate})` : "";
          lines.push(`    - ${parts}${since}${m.notes ? ` — ${m.notes}` : ""}`);
        }
      }
    }
  }

  // ── Symptoms ──────────────────────────────────────────────────────────────
  const symptomRows = await db
    .select()
    .from(symptoms)
    .where(and(eq(symptoms.userId, userId), eq(symptoms.patientId, patientId)))
    .orderBy(desc(symptoms.startDate));

  if (symptomRows.length > 0) {
    lines.push("\n## Symptom History");
    for (const s of symptomRows) {
      const status = s.endDate ? `${s.startDate} → ${s.endDate}` : `${s.startDate} → ongoing`;
      const severity = s.severity ? ` [${s.severity}]` : "";
      lines.push(`  - ${s.name}${severity} · ${status}${s.notes ? ` — ${s.notes}` : ""}`);
    }
  }

  // ── Previous AI Analyses ──────────────────────────────────────────────────
  const analyses = await db
    .select()
    .from(analysisRuns)
    .where(and(eq(analysisRuns.userId, userId), eq(analysisRuns.patientId, patientId)))
    .orderBy(desc(analysisRuns.createdAt))
    .limit(3);

  if (analyses.length > 0) {
    lines.push("\n## Previous AI Analyses");
    for (const a of analyses) {
      if (a.status !== "completed" || !a.result) continue;
      const result = a.result as { summary?: string; progression?: { trend: string; description: string } };
      lines.push(`\n### ${a.createdAt.toISOString().split("T")[0]} — ${a.analysisType.replace(/_/g, " ")} (${a.model})`);
      if (result.summary) lines.push(`Summary: ${result.summary}`);
      if (result.progression) {
        lines.push(`Progression trend: ${result.progression.trend} — ${result.progression.description}`);
      }
    }
  }

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const body = await req.json() as {
      patientId?: string;
      messages: { role: "user" | "assistant"; content: string }[];
      provider?: AIProvider;
      model?: string;
    };

    const { patientId, messages, provider: reqProvider, model } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "messages required", success: false }, { status: 400 });
    }

    const providerName: AIProvider = reqProvider ?? (await getDefaultProviderForUser(userId));
    const apiKey = await resolveProviderKey(providerName, userId);
    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key configured for ${providerName}. Add one in Settings.`, success: false },
        { status: 400 },
      );
    }
    const modelName = model ?? (providerName === "gemini" ? "gemini-2.5-flash" :
                                 providerName === "openai" ? "gpt-4o" :
                                 providerName === "anthropic" ? "claude-sonnet-4-6" : "mistral-large");

    // Build system prompt
    let patientContext = "";
    if (patientId) {
      try {
        patientContext = await buildPatientContext(patientId, userId);
      } catch {
        patientContext = "No patient data available.";
      }
    }

    const systemPrompt = `You are an expert AI medical assistant specialising in oncology. You are helping a caregiver or patient understand and navigate their cancer journey.

Your role:
- Answer questions about the patient's data clearly and compassionately
- Explain medical terms in plain language when asked
- Highlight concerning trends or values that need attention
- Suggest questions to ask the doctor
- Provide context about what test results, findings, or terms mean
- Be honest about uncertainty — never overstate confidence
- Always remind the user that you support, not replace, professional medical advice

Tone: warm, clear, professional. Avoid unnecessary jargon unless asked for technical detail.

${patientContext
  ? `You have access to the following patient data:\n\n${patientContext}\n\nUse this data to give specific, personalised answers.`
  : "No patient has been selected yet. You can still answer general oncology questions."}

IMPORTANT: You are not a doctor. Always recommend consulting the patient's medical team for clinical decisions.`;

    const aiProvider = getProvider(providerName);

    // ── Streaming response ────────────────────────────────────────────────
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (providerName === "gemini") {
            // Gemini supports native streaming
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
              systemInstruction: systemPrompt,
            });

            const history = messages.slice(0, -1).map((m) => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.content }],
            }));

            const chat = geminiModel.startChat({ history });
            const lastMessage = messages[messages.length - 1].content;
            const result = await chat.sendMessageStream(lastMessage);

            for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) controller.enqueue(encoder.encode(text));
            }

          } else if (providerName === "openai") {
            // OpenAI streaming
            const OpenAI = (await import("openai")).default;
            const client = new OpenAI({ apiKey });
            const openaiMessages = [
              { role: "system" as const, content: systemPrompt },
              ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
            ];
            const stream = await client.chat.completions.create({
              model: modelName, messages: openaiMessages,
              stream: true, temperature: 0.4, max_tokens: 4096,
            });
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            }

          } else if (providerName === "anthropic") {
            // Anthropic streaming
            const Anthropic = (await import("@anthropic-ai/sdk")).default;
            const client = new Anthropic({ apiKey });
            const anthropicMessages = messages.map((m) => ({
              role: m.role as "user" | "assistant", content: m.content,
            }));
            const stream = client.messages.stream({
              model: modelName, max_tokens: 4096, temperature: 0.4,
              system: systemPrompt, messages: anthropicMessages,
            });
            for await (const chunk of stream) {
              if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
            }

          } else {
            // Fallback: non-streaming via the generic provider
            const response = await aiProvider.chat({
              provider: providerName, model: modelName, apiKey,
              messages: [{ role: "system", content: systemPrompt }, ...messages],
              temperature: 0.4, maxTokens: 4096,
            });
            controller.enqueue(encoder.encode(response.content));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "Chat failed", success: false }, { status: 500 });
  }
}
