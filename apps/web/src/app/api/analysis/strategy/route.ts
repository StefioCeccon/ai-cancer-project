import { NextRequest, NextResponse } from "next/server";
import { db, patients, imagingStudies, bloodTests, medicalReports } from "@/lib/db";
import type { ImagingStudy, MedicalReport } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";
import { getProvider } from "@/lib/ai/registry";
import { getDefaultProviderForUser, resolveProviderKey } from "@/lib/ai/keys";

const AVAILABLE_MODELS = [
  { id: "Sybil", description: "Lung cancer risk prediction from low-dose chest CT. Validated by MIT/MGH. Outputs 1–6 year risk scores and saliency maps highlighting suspicious regions." },
  { id: "TotalSegmentator", description: "Segments 104 anatomical structures in CT scans (organs, bones, vessels). Useful for any CT to provide anatomical context and localize findings." },
  { id: "TorchXRayVision", description: "Classifies 14 chest pathologies from X-ray (nodules, masses, effusion, pneumonia, etc.). Also produces GradCAM heatmaps." },
  { id: "nnU-Net BraTS", description: "Brain tumor segmentation from MRI (glioma sub-regions: enhancing tumor, necrosis, edema). Competition-winning model." },
  { id: "MedSAM", description: "General-purpose medical image segmentation using prompt points/boxes. Good fallback for modalities without a dedicated model." },
];

const STRATEGY_SYSTEM_PROMPT = `You are an oncology AI analysis strategist. Given a patient's clinical profile and available medical data, you recommend the optimal AI-assisted analysis strategy. Your recommendations are for an oncology monitoring platform used by patients and their care teams — not for autonomous clinical decision making.

Always respond with valid JSON matching the requested schema exactly. Be specific, evidence-based, and clinically sensible.`;

function buildStrategyPrompt(opts: {
  patientContext: string;
  imagingSummary: string;
  bloodSummary: string;
  reportSummary: string;
}): string {
  return `Analyze this patient's profile and available data, then recommend the optimal AI analysis strategy.

## Patient Profile
${opts.patientContext}

## Available Data
${opts.imagingSummary}
${opts.bloodSummary}
${opts.reportSummary}

## Available ML Models
${AVAILABLE_MODELS.map((m) => `- **${m.id}**: ${m.description}`).join("\n")}

## Analysis Types Available
- comprehensive: Full multi-modal analysis across all data
- cancer_progression: Track cancer progression over time
- biomarker_trend: Focus on blood marker trends
- imaging_findings: Extract and interpret imaging findings
- treatment_response: Evaluate response to current treatment
- risk_assessment: Overall risk factor evaluation
- next_steps: Recommend clinical actions
- ml_imaging: Dedicated ML model analysis of imaging studies

Return ONLY valid JSON matching this exact schema:
{
  "recommendedModels": ["model name from the list above"],
  "focusAreas": ["specific anatomical areas or findings to focus on"],
  "rationale": "2-3 sentence explanation of why this strategy fits this patient's situation",
  "analysisTier": "model_only or model_ai",
  "promptContext": "Key clinical context the LLM analyst should know: recent treatment changes, specific findings to track, clinical questions the care team has",
  "dominantModality": "CT or XRAY or MRI or PET or null",
  "warningFlags": ["any clinical flags or data quality concerns worth noting"],
  "recommendedAnalysisType": "one of the analysis types listed above",
  "imagingPriority": "high or medium or low or none"
}`;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const body = await request.json();
    const parsed = z.object({ patientId: z.string().uuid() }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "patientId is required", success: false }, { status: 400 });
    }

    const { patientId } = parsed.data;

    if (!(await canAccessPatient(patientId, userId, "viewer"))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const [patient] = await db.select().from(patients).where(eq(patients.id, patientId));
    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const patientContext = [
      `Cancer type: ${patient.cancerType ?? "unknown"}`,
      `Stage: ${patient.cancerStage ?? "unknown"}`,
      `Diagnosis date: ${patient.diagnosisDate ?? "unknown"}`,
      `Gender: ${patient.gender}`,
      patient.primaryPhysician ? `Primary physician: ${patient.primaryPhysician}` : null,
      patient.notes ? `Clinical notes: ${patient.notes}` : null,
    ].filter(Boolean).join("\n");

    const [studies, tests, reports] = await Promise.all([
      db.select().from(imagingStudies).where(eq(imagingStudies.patientId, patientId)).orderBy(desc(imagingStudies.createdAt)),
      db.select().from(bloodTests).where(eq(bloodTests.patientId, patientId)).orderBy(desc(bloodTests.testDate)),
      db.select().from(medicalReports).where(eq(medicalReports.patientId, patientId)).orderBy(desc(medicalReports.reportDate)),
    ]);

    const imagingSummary = studies.length === 0
      ? "Imaging studies: none available"
      : `Imaging studies (${studies.length} total):\n` +
        (studies as ImagingStudy[]).map((s) => `  - ${s.modality} · ${s.bodyPart} · ${s.studyDate}${s.description ? ` (${s.description})` : ""}`).join("\n");

    const bloodSummary = tests.length === 0
      ? "Blood tests: none available"
      : `Blood tests: ${tests.length} tests, most recent ${tests[0].testDate}`;

    const reportSummary = reports.length === 0
      ? "Medical reports: none available"
      : `Medical reports: ${reports.length} reports (${[...new Set((reports as MedicalReport[]).map((r) => r.reportType))].join(", ")})`;

    const providerName = await getDefaultProviderForUser(userId);
    const provider = getProvider(providerName);
    const apiKey = await resolveProviderKey(providerName, userId);

    const modelId = providerName === "gemini" ? "gemini-2.5-flash"
      : providerName === "openai" ? "gpt-4o-mini"
      : providerName === "anthropic" ? "claude-haiku-4-5-20251001"
      : "gemini-2.5-flash";

    const response = await provider.chat({
      provider: providerName,
      model: modelId,
      apiKey: apiKey ?? undefined,
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 1024,
      messages: [
        { role: "system", content: STRATEGY_SYSTEM_PROMPT },
        { role: "user", content: buildStrategyPrompt({ patientContext, imagingSummary, bloodSummary, reportSummary }) },
      ],
    });

    const strategy = JSON.parse(response.content);

    return NextResponse.json({ data: strategy, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
