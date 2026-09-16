import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, desc, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth/user";
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
import type { Symptom, BloodMarker, BloodTest, MedicalReport, ImagingStudy, AnalysisRun } from "@/lib/db/schema";
import { runMDTConsultation } from "@/lib/ai/consultation";
import { runWithUserKeys } from "@/lib/ai/keyContext";
import type { MDTDocument, MDTSSEEvent, AIProvider } from "@ai-cancer-project/shared";

const schema = z.object({
  patientId: z.string().uuid(),
  provider: z.enum(["gemini", "openai", "anthropic", "mistral"]),
  model: z.string().min(1),
  question: z.string().max(500).optional(),
});

function sseEncode(event: MDTSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      sseEncode({ type: "error", message: "Invalid request" }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const { patientId, provider, model, question } = parsed.data;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: MDTSSEEvent) => {
        controller.enqueue(encoder.encode(sseEncode(event)));
      };

      let runId: string | undefined;

      try {
        // Fetch patient
        const [patient] = await db
          .select()
          .from(patients)
          .where(and(eq(patients.id, patientId), eq(patients.userId, userId)));
        if (!patient) {
          send({ type: "error", message: `Patient ${patientId} not found` });
          controller.close();
          return;
        }

        // Insert analysis run record
        const [run] = await db
          .insert(analysisRuns)
          .values({
            patientId,
            userId,
            analysisType: "mdt_consultation",
            provider: provider as AIProvider,
            model,
            status: "running",
            inputDataIds: {},
          })
          .returning();
        runId = run.id;

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

        // Fetch all patient data in parallel
        const [therapyRows, symptomRows, bloodTestRows, reportRows, imagingRows] =
          await Promise.all([
            db.select().from(therapies).where(and(eq(therapies.userId, userId), eq(therapies.patientId, patientId))).orderBy(desc(therapies.startDate)),
            db.select().from(symptoms).where(and(eq(symptoms.userId, userId), eq(symptoms.patientId, patientId))).orderBy(desc(symptoms.startDate)),
            db.select().from(bloodTests).where(and(eq(bloodTests.userId, userId), eq(bloodTests.patientId, patientId))).orderBy(desc(bloodTests.testDate)),
            db.select().from(medicalReports).where(and(eq(medicalReports.userId, userId), eq(medicalReports.patientId, patientId))).orderBy(desc(medicalReports.reportDate)),
            db.select().from(imagingStudies).where(and(eq(imagingStudies.userId, userId), eq(imagingStudies.patientId, patientId))).orderBy(desc(imagingStudies.studyDate)),
          ]);

        // Therapy — always-on context (fetch meds per therapy)
        let therapyData: string | undefined;
        if (therapyRows.length > 0) {
          const lines: string[] = [];
          for (const t of therapyRows) {
            const status = t.endDate ? `${t.startDate} → ${t.endDate}` : `${t.startDate} → ongoing`;
            lines.push(`${t.name} (${t.therapyType.replace(/_/g, " ")}) · ${status}`);
            if (t.dosage || t.frequency) lines.push(`  ${[t.dosage, t.frequency].filter(Boolean).join(" · ")}`);
            if (t.notes) lines.push(`  Notes: ${t.notes}`);
            const meds = await db.select().from(therapyMedications).where(eq(therapyMedications.therapyId, t.id));
            for (const m of meds) {
              const parts = [m.name, m.dosage, m.frequency, m.route].filter(Boolean).join(" · ");
              lines.push(`  - ${parts}${m.notes ? ` — ${m.notes}` : ""}`);
            }
          }
          therapyData = lines.join("\n");
        }

        // Symptoms — always-on context
        let symptomData: string | undefined;
        if (symptomRows.length > 0) {
          symptomData = symptomRows
            .map((s: Symptom) => {
              const status = s.endDate ? `${s.startDate} → ${s.endDate}` : `${s.startDate} → ongoing`;
              return `- ${s.name}${s.severity ? ` [${s.severity}]` : ""} · ${status}${s.notes ? ` — ${s.notes}` : ""}`;
            })
            .join("\n");
        }

        // Fetch all blood markers for all tests in one query
        const bloodTestIds = bloodTestRows.map((t: BloodTest) => t.id);
        const allMarkers: BloodMarker[] = bloodTestIds.length > 0
          ? await db.select().from(bloodMarkers).where(inArray(bloodMarkers.bloodTestId, bloodTestIds))
          : [];
        const markersByTest: Record<string, BloodMarker[]> = {};
        for (const m of allMarkers) {
          if (!markersByTest[m.bloodTestId]) markersByTest[m.bloodTestId] = [];
          markersByTest[m.bloodTestId].push(m);
        }

        // Build selectable documents
        const documents: MDTDocument[] = [
          // Blood tests
          ...bloodTestRows.map((t: BloodTest) => {
            const markers = markersByTest[t.id] ?? [];
            const markerLines = markers.map(
              (m: BloodMarker) =>
                `  - ${m.name}: ${m.value} ${m.unit} [${m.status}]${m.referenceMin != null || m.referenceMax != null ? ` (ref: ${m.referenceMin ?? "?"}-${m.referenceMax ?? "?"})` : ""}${m.notes ? ` | ${m.notes}` : ""}`,
            );
            return {
              id: `blood-${t.id}`,
              type: "blood_test" as const,
              date: t.testDate ?? "",
              title: `Blood Test — ${t.testDate ?? "unknown"}${t.labName ? ` (${t.labName})` : ""} · ${markers.length} marker${markers.length !== 1 ? "s" : ""}`,
              fullContent: `Blood test ${t.testDate ?? ""}${t.labName ? ` (${t.labName})` : ""}:\n${markerLines.join("\n") || "  No markers recorded"}`,
            };
          }),
          // Medical reports
          ...reportRows.map((r: MedicalReport) => ({
            id: `report-${r.id}`,
            type: "report" as const,
            date: r.reportDate ?? "",
            title: `${r.title} [${r.reportType}] — ${r.reportDate ?? "unknown"}${r.author ? ` · ${r.author}` : ""}`,
            fullContent: [
              `Report: ${r.title} [${r.reportType}] ${r.reportDate ?? ""}`,
              r.author ? `Author: ${r.author}` : null,
              r.institution ? `Institution: ${r.institution}` : null,
              r.aiSummary ? `AI Summary: ${r.aiSummary}` : null,
              r.rawText ? `Full content:\n${r.rawText.slice(0, 6000)}` : null,
            ].filter(Boolean).join("\n"),
          })),
          // Imaging studies
          ...imagingRows.map((s: ImagingStudy) => ({
            id: `imaging-${s.id}`,
            type: "imaging" as const,
            date: s.studyDate ?? "",
            title: `${s.modality} — ${s.bodyPart ?? "unknown"} (${s.studyDate ?? "unknown"})${s.description ? ` · ${s.description.slice(0, 60)}` : ""}`,
            fullContent: [
              `Imaging: ${s.modality} — ${s.bodyPart ?? "unknown"} (${s.studyDate ?? ""})`,
              s.description ? `Description: ${s.description}` : null,
              s.radiologistReport ? `Radiologist report:\n${s.radiologistReport}` : null,
              s.aiFindings ? `AI findings: ${s.aiFindings}` : null,
              s.mlModelResults ? `ML results: ${JSON.stringify(s.mlModelResults)}` : null,
            ].filter(Boolean).join("\n"),
          })),
        ];

        const startTime = Date.now();
        let consultationResult: Awaited<ReturnType<typeof runMDTConsultation>> | undefined;

        try {
          consultationResult = await runWithUserKeys(userId, () =>
            runMDTConsultation(
              {
                patientContext,
                cancerType: patient.cancerType,
                therapyData,
                symptomData,
                documents,
                provider,
                model,
                consultationQuestion: question,
              },
              (event: MDTSSEEvent) => { send(event); }
            )
          );

          // Store and close
          const durationMs = Date.now() - startTime;

          await db
            .update(analysisRuns)
            .set({
              status: "completed",
              result: consultationResult as unknown as Record<string, unknown>,
              durationMs,
              completedAt: new Date(),
            })
            .where(and(eq(analysisRuns.id, run.id), eq(analysisRuns.userId, userId)));

          send({ type: "done", runId: run.id });
        } catch (consultationError) {
          const message = consultationError instanceof Error ? consultationError.message : "Consultation failed";
          await db
            .update(analysisRuns)
            .set({ status: "failed", errorMessage: message, completedAt: new Date() })
            .where(and(eq(analysisRuns.id, run.id), eq(analysisRuns.userId, userId)));
          send({ type: "error", message });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (runId) {
          try {
            await db.update(analysisRuns).set({ status: "failed", errorMessage: message, completedAt: new Date() }).where(and(eq(analysisRuns.id, runId), eq(analysisRuns.userId, userId)));
          } catch { /* ignore */ }
        }
        send({ type: "error", message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");

  try {
    const data = patientId
      ? await db.select().from(analysisRuns).where(and(eq(analysisRuns.userId, userId), eq(analysisRuns.patientId, patientId))).orderBy(desc(analysisRuns.createdAt))
      : await db.select().from(analysisRuns).where(eq(analysisRuns.userId, userId)).orderBy(desc(analysisRuns.createdAt));

    const mdtRuns = (data as AnalysisRun[]).filter((r: AnalysisRun) => r.analysisType === "mdt_consultation");
    return Response.json({ data: mdtRuns, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message, success: false }, { status: 500 });
  }
}
