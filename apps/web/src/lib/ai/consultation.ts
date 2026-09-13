import type {
  MDTSpecialistRole,
  MDTSpecialistReport,
  MDTConsultationResult,
  MDTDocument,
  MDTFollowUpRound,
  MDTSSEEvent,
  AIProvider,
} from "@cancer-monitor/shared";
import { getProvider } from "./registry";
import {
  SPECIALIST_SYSTEM_PROMPTS,
  buildSpecialistPrompt,
  buildDiscussionPrompt,
  buildFollowUpAnswerPrompt,
  buildFollowUpExtractionPrompt,
  buildOncologistSynthesisPrompt,
} from "./prompts";
import { runResearchDoctor } from "./agents/research-doctor";
import { runClinicalTrials } from "./agents/clinical-trials";

export interface MDTConsultationRequest {
  patientContext: string;
  cancerType: string | null;
  therapyData?: string;
  symptomData?: string;
  documents: MDTDocument[];
  provider: AIProvider;
  model: string;
  consultationQuestion?: string;
}

const PARALLEL_SPECIALISTS: MDTSpecialistRole[] = [
  "radiologist",
  "endocrinologist",
  "pathologist",
  "palliative",
  "research_doctor",
  "clinical_trials",
];

// Fallback document types used if LLM selection returns nothing
const SPECIALIST_PRIMARY_DOCUMENT_TYPES: Record<
  MDTSpecialistRole,
  Array<MDTDocument["type"]>
> = {
  radiologist:     ["imaging", "report"],
  endocrinologist: ["blood_test"],
  pathologist:     ["report"],
  palliative:      ["blood_test", "report"],
  research_doctor: ["report", "blood_test"],
  clinical_trials: ["blood_test", "report"],
  oncologist:      ["imaging", "report", "blood_test"],
};

const MAX_FOLLOWUP_ROUNDS = 3;

// ─── Document selection ───────────────────────────────────────────────────────

async function selectDocuments(
  role: MDTSpecialistRole,
  request: MDTConsultationRequest,
): Promise<{ ids: string[]; titles: string[] }> {
  if (request.documents.length === 0) return { ids: [], titles: [] };

  const { provider, model } = request;
  const aiProvider = getProvider(provider);

  const indexLines = request.documents.map(
    (d, i) => `${i + 1}. [${d.type}] ${d.title}`,
  );

  const roleLabel = role.replace(/_/g, " ");

  console.log(`[MDT selectDocuments] ${role} — ${request.documents.length} docs available`);

  try {
    const response = await aiProvider.chat({
      provider,
      model,
      temperature: 0,
      maxTokens: 120,
      messages: [
        { role: "system", content: SPECIALIST_SYSTEM_PROMPTS[role] },
        {
          role: "user",
          content: `## Patient Overview\n${request.patientContext}\n\n## Available Documents\n${indexLines.join("\n")}\n\nYou are a ${roleLabel}. Select ALL documents relevant to your specialty — do not limit yourself, pick as many as you need for a thorough assessment.\nReply with ONLY the document numbers separated by commas. Example: 1, 2, 4, 7, 9`,
        },
      ],
    });

    console.log(`[MDT selectDocuments] ${role} raw response: ${JSON.stringify(response.content)}`);

    // Extract integers from anywhere in the response — robust to any format
    const matches = Array.from(response.content.matchAll(/\b(\d+)\b/g));
    const uniqueIndices = [
      ...new Set(
        matches
          .map((m) => parseInt(m[1], 10))
          .filter((n) => n >= 1 && n <= request.documents.length),
      ),
    ];

    console.log(`[MDT selectDocuments] ${role} extracted indices: [${uniqueIndices.join(", ")}]`);

    if (uniqueIndices.length > 0) {
      const selected = uniqueIndices.map((i) => request.documents[i - 1]).filter(Boolean);
      console.log(`[MDT selectDocuments] ${role} selected: ${selected.map((d) => d.title).join(", ")}`);
      return { ids: selected.map((d) => d.id), titles: selected.map((d) => d.title) };
    }

    console.warn(`[MDT selectDocuments] ${role} — no valid indices extracted, using type-based fallback`);
  } catch (err) {
    console.error(`[MDT selectDocuments] ${role} — LLM call failed:`, err);
  }

  // Fallback: give the specialist all documents of their primary type(s)
  const primaryTypes = SPECIALIST_PRIMARY_DOCUMENT_TYPES[role];
  const fallback = request.documents.filter((d) => primaryTypes.includes(d.type));
  console.log(`[MDT selectDocuments] ${role} fallback docs (${fallback.length}): ${fallback.map((d) => d.title).join(", ")}`);
  return { ids: fallback.map((d) => d.id), titles: fallback.map((d) => d.title) };
}

// ─── Round 1: specialist reports ─────────────────────────────────────────────

async function runSpecialist(
  role: MDTSpecialistRole,
  request: MDTConsultationRequest,
  selectedDocsByRole: Partial<Record<MDTSpecialistRole, string[]>>,
  onEvent: (event: MDTSSEEvent) => void,
): Promise<string> {
  const { provider, model } = request;

  // Step 1 – let specialist pick their documents
  const { ids: selectedIds, titles: selectedTitles } = await selectDocuments(role, request);
  selectedDocsByRole[role] = selectedIds;
  onEvent({ type: "specialist_selecting", role, selectedTitles });

  // Build full content for selected documents
  const selectedContent = request.documents
    .filter((d) => selectedIds.includes(d.id))
    .map((d) => d.fullContent)
    .join("\n\n---\n\n");

  // Step 2 – run analysis
  if (role === "research_doctor") {
    return runResearchDoctor({
      patientContext: request.patientContext,
      cancerType: request.cancerType,
      therapyData: request.therapyData,
      symptomData: request.symptomData,
      selectedDocuments: selectedContent || undefined,
      provider,
      model,
    });
  }

  if (role === "clinical_trials") {
    return runClinicalTrials({
      patientContext: request.patientContext,
      cancerType: request.cancerType,
      therapyData: request.therapyData,
      selectedDocuments: selectedContent || undefined,
      provider,
      model,
    });
  }

  const aiProvider = getProvider(provider);
  const userPrompt = buildSpecialistPrompt({
    role,
    patientContext: request.patientContext,
    therapyData: request.therapyData,
    symptomData: request.symptomData,
    selectedDocuments: selectedContent || undefined,
  });

  const response = await aiProvider.chat({
    provider,
    model,
    temperature: 0.3,
    maxTokens: 1500,
    messages: [
      { role: "system", content: SPECIALIST_SYSTEM_PROMPTS[role] },
      { role: "user", content: userPrompt },
    ],
  });

  return response.content;
}

// ─── Round 2: inter-specialist discussion ────────────────────────────────────

async function runDiscussion(
  role: MDTSpecialistRole,
  request: MDTConsultationRequest,
  ownReport: string,
  othersReports: Array<{ role: MDTSpecialistRole; report: string }>,
): Promise<string> {
  const { provider, model } = request;
  const aiProvider = getProvider(provider);

  const userPrompt = buildDiscussionPrompt({
    patientContext: request.patientContext,
    ownReport,
    othersReports,
  });

  const response = await aiProvider.chat({
    provider,
    model,
    temperature: 0.3,
    maxTokens: 1000,
    messages: [
      { role: "system", content: SPECIALIST_SYSTEM_PROMPTS[role] },
      { role: "user", content: userPrompt },
    ],
  });

  return response.content;
}

// ─── Follow-up answer ────────────────────────────────────────────────────────

async function runFollowUpAnswer(
  role: MDTSpecialistRole,
  request: MDTConsultationRequest,
  question: string,
  selectedIds: string[],
): Promise<string> {
  const { provider, model } = request;

  // Reuse the documents the specialist already selected in Round 1
  const selectedContent = request.documents
    .filter((d) => selectedIds.includes(d.id))
    .map((d) => d.fullContent)
    .join("\n\n---\n\n");

  if (role === "research_doctor") {
    return runResearchDoctor({
      patientContext: `${request.patientContext}\n\nOncologist follow-up: ${question}`,
      cancerType: request.cancerType,
      selectedDocuments: selectedContent || undefined,
      provider,
      model,
    });
  }

  if (role === "clinical_trials") {
    return runClinicalTrials({
      patientContext: `${request.patientContext}\n\nOncologist follow-up: ${question}`,
      cancerType: request.cancerType,
      selectedDocuments: selectedContent || undefined,
      provider,
      model,
    });
  }

  const aiProvider = getProvider(provider);
  const userPrompt = buildFollowUpAnswerPrompt({
    question,
    patientContext: request.patientContext,
    selectedDocuments: selectedContent || undefined,
  });

  const response = await aiProvider.chat({
    provider,
    model,
    temperature: 0.3,
    maxTokens: 300,
    messages: [
      { role: "system", content: SPECIALIST_SYSTEM_PROMPTS[role] },
      { role: "user", content: userPrompt },
    ],
  });

  return response.content;
}

// ─── Oncologist synthesis ────────────────────────────────────────────────────

async function synthesise(
  request: MDTConsultationRequest,
  specialists: Partial<Record<MDTSpecialistRole, MDTSpecialistReport>>,
  discussions: Partial<Record<MDTSpecialistRole, string>>,
  followUpRounds: MDTFollowUpRound[],
): Promise<string> {
  const { provider, model } = request;
  const aiProvider = getProvider(provider);

  const prompt = buildOncologistSynthesisPrompt({
    patientContext: request.patientContext,
    specialistReports: PARALLEL_SPECIALISTS.map((role) => ({
      role,
      report: specialists[role]!.report,
    })),
    discussions: Object.keys(discussions).length > 0 ? discussions : undefined,
    followUpRounds: followUpRounds.length > 0 ? followUpRounds : undefined,
    consultationQuestion: request.consultationQuestion,
  });

  const response = await aiProvider.chat({
    provider,
    model,
    temperature: 0.3,
    maxTokens: 4000,
    messages: [
      { role: "system", content: SPECIALIST_SYSTEM_PROMPTS.oncologist },
      { role: "user", content: prompt },
    ],
  });

  return response.content;
}

// ─── Follow-up question extraction ───────────────────────────────────────────

async function extractFollowUpQuestions(
  synthesis: string,
  provider: AIProvider,
  model: string,
): Promise<Array<{ role: MDTSpecialistRole; question: string }>> {
  const aiProvider = getProvider(provider);

  try {
    const response = await aiProvider.chat({
      provider,
      model,
      temperature: 0,
      maxTokens: 300,
      jsonMode: true,
      messages: [
        {
          role: "system",
          content: "You extract follow-up questions from MDT syntheses. Return ONLY a valid JSON array.",
        },
        { role: "user", content: buildFollowUpExtractionPrompt(synthesis) },
      ],
    });

    const parsed = JSON.parse(response.content);
    if (!Array.isArray(parsed)) return [];

    return (parsed as unknown[])
      .filter(
        (q): q is { role: string; question: string } =>
          typeof q === "object" &&
          q !== null &&
          typeof (q as Record<string, unknown>).role === "string" &&
          typeof (q as Record<string, unknown>).question === "string",
      )
      .filter((q) => (PARALLEL_SPECIALISTS as string[]).includes(q.role))
      .slice(0, 3) as Array<{ role: MDTSpecialistRole; question: string }>;
  } catch {
    return [];
  }
}

// ─── Main orchestration ───────────────────────────────────────────────────────

export async function runMDTConsultation(
  request: MDTConsultationRequest,
  onEvent: (event: MDTSSEEvent) => void,
): Promise<MDTConsultationResult> {
  const specialists: Partial<Record<MDTSpecialistRole, MDTSpecialistReport>> = {};
  const discussions: Partial<Record<MDTSpecialistRole, string>> = {};
  const followUpRounds: MDTFollowUpRound[] = [];
  // Track each specialist's selected document IDs for reuse in follow-up answers
  const selectedDocsByRole: Partial<Record<MDTSpecialistRole, string[]>> = {};

  // ── Round 1: parallel specialist reports ─────────────────────────────────
  await Promise.all(
    PARALLEL_SPECIALISTS.map(async (role) => {
      const report = await runSpecialist(role, request, selectedDocsByRole, onEvent);
      const completedAt = new Date().toISOString();
      specialists[role] = { role, report, completedAt };
      onEvent({ type: "specialist", role, report, completedAt });
    }),
  );

  // ── Round 2: inter-specialist discussion ──────────────────────────────────
  onEvent({ type: "phase", phase: "discussion" });

  await Promise.all(
    PARALLEL_SPECIALISTS.map(async (role) => {
      const othersReports = PARALLEL_SPECIALISTS.filter((r) => r !== role).map((r) => ({
        role: r,
        report: specialists[r]!.report,
      }));

      const comment = await runDiscussion(role, request, specialists[role]!.report, othersReports);
      const completedAt = new Date().toISOString();
      discussions[role] = comment;
      onEvent({ type: "discussion", role, comment, completedAt });
    }),
  );

  // ── Oncologist loop ───────────────────────────────────────────────────────
  onEvent({ type: "phase", phase: "synthesis" });

  let finalReport = "";
  let finalCompletedAt = "";

  for (let attempt = 0; attempt <= MAX_FOLLOWUP_ROUNDS; attempt++) {
    const report = await synthesise(request, specialists, discussions, followUpRounds);
    const completedAt = new Date().toISOString();

    const questions =
      attempt < MAX_FOLLOWUP_ROUNDS
        ? await extractFollowUpQuestions(report, request.provider, request.model)
        : [];

    if (questions.length === 0) {
      finalReport = report;
      finalCompletedAt = completedAt;
      onEvent({ type: "synthesis", report, completedAt });
      break;
    }

    const round = attempt + 1;
    onEvent({ type: "synthesis_draft", report, round, completedAt });
    onEvent({ type: "phase", phase: "followup", round });

    for (const { role, question } of questions) {
      onEvent({ type: "followup_question", toRole: role, question, round });
    }

    const answers: Partial<Record<MDTSpecialistRole, string>> = {};
    await Promise.all(
      questions.map(async ({ role, question }) => {
        const selectedIds = selectedDocsByRole[role] ?? [];
        const answer = await runFollowUpAnswer(role, request, question, selectedIds);
        const answerCompletedAt = new Date().toISOString();
        answers[role] = answer;
        onEvent({ type: "followup_answer", role, answer, round, completedAt: answerCompletedAt });
      }),
    );

    followUpRounds.push({ round, questions, answers, synthesisDraft: report });
    onEvent({ type: "phase", phase: "synthesis" });
  }

  return {
    specialists,
    discussions,
    followUpRounds,
    synthesis: { role: "oncologist", report: finalReport, completedAt: finalCompletedAt },
  };
}
