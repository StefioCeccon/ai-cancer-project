import { NextRequest, NextResponse } from "next/server";
import {
  db,
  patients,
  bloodTests,
  bloodMarkers,
  medicalReports,
  imagingStudies,
  analysisRuns,
  symptoms,
  therapies,
  therapyMedications,
} from "@/lib/db";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId, isPatientOwnedBy } from "@/lib/auth/user";
import { runOncologyAnalysis } from "@/lib/ai";
import { runWithUserKeys } from "@/lib/ai/keyContext";
import {
  buildImagingAnalysisSummary,
  formatMlImagingContext,
} from "@/lib/imaging/mlContext";
import type { ImagingAnalysisSummary } from "@cancer-monitor/shared";
import type { Symptom } from "@/lib/db/schema";

const createAnalysisSchema = z.object({
  patientId: z.string().uuid(),
  analysisType: z.enum([
    "cancer_progression",
    "biomarker_trend",
    "imaging_findings",
    "treatment_response",
    "risk_assessment",
    "next_steps",
    "comprehensive",
    "ml_imaging",
  ]),
  provider: z.enum(["gemini", "openai", "anthropic", "mistral"]),
  model: z.string().min(1),
  inputDataIds: z
    .object({
      bloodTestIds: z.array(z.string().uuid()).optional(),
      reportIds: z.array(z.string().uuid()).optional(),
      imagingStudyIds: z.array(z.string().uuid()).optional(),
    })
    .default({}),
  strategyContext: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    const data = patientId
      ? await db
          .select()
          .from(analysisRuns)
          .where(and(eq(analysisRuns.userId, userId), eq(analysisRuns.patientId, patientId)))
          .orderBy(desc(analysisRuns.createdAt))
      : await db
          .select()
          .from(analysisRuns)
          .where(eq(analysisRuns.userId, userId))
          .orderBy(desc(analysisRuns.createdAt));

    return NextResponse.json({ data, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let runId: string | undefined;
  let ownerId: string | undefined;

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }
    ownerId = userId;

    const body = await request.json();
    const parsed = createAnalysisSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const { patientId, analysisType, provider, model, inputDataIds, strategyContext } = parsed.data;

    if (!(await isPatientOwnedBy(patientId, userId))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    // Insert the run record with status "running"
    const [run] = await db
      .insert(analysisRuns)
      .values({
        patientId,
        userId,
        analysisType,
        provider,
        model,
        status: "running",
        inputDataIds,
      })
      .returning();

    runId = run.id;

    // Fetch patient
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.userId, userId)));
    if (!patient) {
      throw new Error(`Patient ${patientId} not found`);
    }

    const patientContext = [
      `Patient: ${patient.firstName} ${patient.lastName}`,
      `Date of birth: ${patient.dateOfBirth}`,
      patient.gender ? `Gender: ${patient.gender}` : null,
      patient.cancerType ? `Cancer type: ${patient.cancerType}` : null,
      patient.cancerStage ? `Stage: ${patient.cancerStage}` : null,
      patient.diagnosisDate ? `Diagnosis date: ${patient.diagnosisDate}` : null,
      patient.primaryPhysician ? `Primary physician: ${patient.primaryPhysician}` : null,
      patient.notes ? `Notes: ${patient.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Always include therapies and symptoms as background context
    const [therapyRows, symptomRows] = await Promise.all([
      db.select().from(therapies).where(and(eq(therapies.userId, userId), eq(therapies.patientId, patientId))).orderBy(desc(therapies.startDate)),
      db.select().from(symptoms).where(and(eq(symptoms.userId, userId), eq(symptoms.patientId, patientId))).orderBy(desc(symptoms.startDate)),
    ]);

    let therapyData: string | undefined;
    if (therapyRows.length > 0) {
      const therapyLines: string[] = [];
      for (const t of therapyRows) {
        const status = t.endDate ? `${t.startDate} → ${t.endDate}` : `${t.startDate} → ongoing`;
        therapyLines.push(`${t.name} (${t.therapyType.replace(/_/g, " ")}) · ${status}`);
        if (t.dosage || t.frequency) therapyLines.push(`  ${[t.dosage, t.frequency].filter(Boolean).join(" · ")}`);
        if (t.notes) therapyLines.push(`  Notes: ${t.notes}`);
        const meds = await db
          .select()
          .from(therapyMedications)
          .where(eq(therapyMedications.therapyId, t.id))
          .orderBy(therapyMedications.startDate);
        for (const m of meds) {
          const parts = [m.name, m.dosage, m.frequency, m.route].filter(Boolean).join(" · ");
          const since = m.startDate ? ` (from ${m.startDate})` : "";
          therapyLines.push(`  - ${parts}${since}${m.notes ? ` — ${m.notes}` : ""}`);
        }
      }
      therapyData = therapyLines.join("\n");
    }

    let symptomData: string | undefined;
    if (symptomRows.length > 0) {
      symptomData = symptomRows.map((s: Symptom) => {
        const status = s.endDate ? `${s.startDate} → ${s.endDate}` : `${s.startDate} → ongoing`;
        const severity = s.severity ? ` [${s.severity}]` : "";
        return `- ${s.name}${severity} · ${status}${s.notes ? ` — ${s.notes}` : ""}`;
      }).join("\n");
    }

    // Fetch blood tests (skip for ml_imaging-only focus)
    let bloodTestData: string | undefined;
    const bloodTestIds = analysisType === "ml_imaging" ? [] : (inputDataIds.bloodTestIds ?? []);
    if (bloodTestIds.length > 0) {
      const tests = await Promise.all(
        bloodTestIds.map(async (btId) => {
          const [test] = await db.select().from(bloodTests).where(and(eq(bloodTests.id, btId), eq(bloodTests.userId, userId)));
          const markers = test
            ? await db.select().from(bloodMarkers).where(eq(bloodMarkers.bloodTestId, btId))
            : [];
          return test ? { ...test, markers } : null;
        })
      );

      const validTests = tests.filter(Boolean);
      if (validTests.length > 0) {
        bloodTestData = validTests
          .map((t) => {
            const markerLines = t!.markers
              .map(
                (m: typeof bloodMarkers.$inferSelect) =>
                  `  - ${m.name}: ${m.value} ${m.unit} [${m.status}]${m.referenceMin != null || m.referenceMax != null ? ` (ref: ${m.referenceMin ?? "?"}-${m.referenceMax ?? "?"})` : ""}${m.notes ? ` | ${m.notes}` : ""}`
              )
              .join("\n");
            return [
              `Blood test ${t!.testDate}${t!.labName ? ` (${t!.labName})` : ""}:`,
              markerLines || "  No markers",
            ].join("\n");
          })
          .join("\n\n");
      }
    }

    // Fetch reports (skip for ml_imaging-only focus)
    let reportData: string | undefined;
    const reportIds = analysisType === "ml_imaging" ? [] : (inputDataIds.reportIds ?? []);
    if (reportIds.length > 0) {
      const reports = await Promise.all(
        reportIds.map(async (rId) => {
          const [report] = await db
            .select()
            .from(medicalReports)
            .where(and(eq(medicalReports.id, rId), eq(medicalReports.userId, userId)));
          return report ?? null;
        })
      );

      const validReports = reports.filter(Boolean);
      if (validReports.length > 0) {
        reportData = validReports
          .map((r) =>
            [
              `Report: ${r!.title} [${r!.reportType}] ${r!.reportDate}`,
              r!.author ? `Author: ${r!.author}` : null,
              r!.institution ? `Institution: ${r!.institution}` : null,
              r!.aiSummary ? `Summary: ${r!.aiSummary}` : null,
              r!.rawText ? `Content:\n${r!.rawText}` : null,
            ]
              .filter(Boolean)
              .join("\n")
          )
          .join("\n\n");
      }
    }

    // Fetch imaging studies for context (includes ML model results)
    let imagingFindings: string | undefined;
    let imagingAnalysisSummaries: ImagingAnalysisSummary[] = [];
    const imagingStudyIds = inputDataIds.imagingStudyIds ?? [];
    if (imagingStudyIds.length > 0) {
      const studies = await Promise.all(
        imagingStudyIds.map(async (isId) => {
          const [study] = await db
            .select()
            .from(imagingStudies)
            .where(and(eq(imagingStudies.id, isId), eq(imagingStudies.userId, userId)));
          return study ?? null;
        })
      );

      const validStudies = studies.filter(Boolean);
      if (validStudies.length > 0) {
        imagingAnalysisSummaries = validStudies
          .map((s) => buildImagingAnalysisSummary(s!))
          .filter((s): s is ImagingAnalysisSummary => s != null);

        imagingFindings = validStudies
          .map((s) => formatMlImagingContext(s!))
          .join("\n\n---\n\n");
      }
    }

    if (strategyContext) {
      imagingFindings = [
        `## Strategy Context\n${strategyContext}`,
        imagingFindings,
      ].filter(Boolean).join("\n\n");
    }

    const startTime = Date.now();

    const result = await runWithUserKeys(userId, () =>
      runOncologyAnalysis(
        {
          patientContext,
          analysisType,
          bloodTestData,
          reportData,
          imagingFindings,
          therapyData,
          symptomData,
        },
        provider,
        model
      )
    );

    if (imagingAnalysisSummaries.length > 0) {
      result.imagingAnalysis = imagingAnalysisSummaries;
    }

    const durationMs = Date.now() - startTime;

    const [updated] = await db
      .update(analysisRuns)
      .set({
        status: "completed",
        result,
        durationMs,
        completedAt: new Date(),
      })
      .where(and(eq(analysisRuns.id, run.id), eq(analysisRuns.userId, userId)))
      .returning();

    return NextResponse.json({ data: updated, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (runId) {
      try {
        await db
          .update(analysisRuns)
          .set({
            status: "failed",
            errorMessage: message,
            completedAt: new Date(),
          })
          .where(
            ownerId
              ? and(eq(analysisRuns.id, runId), eq(analysisRuns.userId, ownerId))
              : eq(analysisRuns.id, runId)
          );
      } catch {
        // Ignore update failure — original error is more important
      }
    }

    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
