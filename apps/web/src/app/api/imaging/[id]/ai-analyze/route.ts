import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, imagingStudies, imagingSeries, imagingInstances, medicalReports } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";
import { buildImagingSystemPrompt, buildImagingUserPrompt } from "@/lib/ai/imagingPrompts";
import { buildImagingReportContext } from "@/lib/imaging/linkedReport";
import { dicomBufferToPng } from "@/lib/imaging/dicomToPng";
import { selectAnalysisSlices } from "@/lib/imaging/selectAnalysisSlices";
import type { SybilResultLike } from "@/lib/imaging/sybil";
import { resolveProviderKey } from "@/lib/ai/keys";
import { getObjectBytes } from "@/lib/storage";

export const maxDuration = 120;

const GEMINI_VISION_MODEL = "gemini-2.5-flash";

interface AiAnalyzeRequest {
  tier?: "model_ai" | "model_only";
  includeManualFlags?: boolean;
  includeMlHighlights?: boolean;
  provider?: "gemini";
  fullImage?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as AiAnalyzeRequest;

    if (body.tier === "model_only") {
      return NextResponse.json({
        error: "tier model_only does not call the LLM. Use Sybil results directly.",
        success: false,
      }, { status: 400 });
    }

    const providerName = body.provider ?? "gemini";
    if (providerName !== "gemini") {
      return NextResponse.json({ error: "Only gemini provider is supported for imaging vision", success: false }, { status: 400 });
    }

    const geminiApiKey = await resolveProviderKey("gemini", userId);
    if (!geminiApiKey) {
      return NextResponse.json({
        error: "No Gemini API key configured. Add one in Settings or set GEMINI_API_KEY.",
        success: false,
      }, { status: 503 });
    }

    const [study] = await db.select().from(imagingStudies).where(eq(imagingStudies.id, id));
    if (!study || !(await canAccessPatient(study.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Study not found", success: false }, { status: 404 });
    }

    const series = await db.select().from(imagingSeries).where(eq(imagingSeries.studyId, id));
    const instances = series.length > 0
      ? (await Promise.all((series as { id: string }[]).map((s) =>
          db.select().from(imagingInstances).where(eq(imagingInstances.seriesId, s.id)),
        ))).flat()
      : [];

    if (instances.length === 0) {
      return NextResponse.json({ error: "No DICOM instances found for this study", success: false }, { status: 400 });
    }

    const mlResults = study.mlModelResults as { sybil?: SybilResultLike & { series_number?: number | string } } | null;
    const rawSybil = mlResults?.sybil ?? null;
    const sybil = rawSybil
      ? {
          ...rawSybil,
          series_number: rawSybil.series_number != null ? Number(rawSybil.series_number) : undefined,
          high_risk_instances: rawSybil.high_risk_instances ?? [],
        }
      : null;

    const includeManualFlags = body.includeManualFlags !== false;
    const includeMlHighlights = body.includeMlHighlights !== false;

    let slices = selectAnalysisSlices({
      instances,
      series,
      sybil,
      includeManualFlags,
      includeMlHighlights,
    });

    if (slices.length === 0 && study.modality === "XRAY" && body.fullImage !== false) {
      const inst = [...instances].sort((a, b) => a.instanceNumber - b.instanceNumber)[0];
      if (inst) {
        const meta = (series as { id: string; seriesNumber: number; description: string | null }[])
          .find((s) => s.id === inst.seriesId);
        slices = [{
          instanceId: inst.id,
          filePath: inst.filePath,
          instanceNumber: inst.instanceNumber,
          seriesNumber: meta?.seriesNumber ?? 0,
          seriesDescription: meta?.description ?? null,
          sources: ["manual"],
        }];
      }
    }

    if (slices.length === 0) {
      const sybilHint = sybil?.high_risk_instances?.length || sybil?.high_risk_file_paths?.length
        ? " Sybil highlights were found but could not be matched to stored instances — try refreshing the page."
        : "";
      return NextResponse.json({
        error: `No slices selected. Flag slices in the viewer and/or run Sybil analysis first.${sybilHint}`,
        success: false,
      }, { status: 400 });
    }

    const pngBuffers: Buffer[] = [];
    const usedSlices: typeof slices = [];
    const conversionErrors: string[] = [];

    for (const slice of slices) {
      try {
        pngBuffers.push(await dicomBufferToPng(await getObjectBytes(slice.filePath)));
        usedSlices.push(slice);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Conversion failed";
        conversionErrors.push(`Instance ${slice.instanceNumber}: ${message}`);
      }
    }

    if (pngBuffers.length === 0) {
      return NextResponse.json({
        error: `Failed to convert DICOM slices to PNG. ${conversionErrors.join("; ")}`,
        success: false,
      }, { status: 500 });
    }

    const linkedReports = await db
      .select({
        title: medicalReports.title,
        reportType: medicalReports.reportType,
        reportDate: medicalReports.reportDate,
        author: medicalReports.author,
        rawText: medicalReports.rawText,
        aiSummary: medicalReports.aiSummary,
      })
      .from(medicalReports)
      .where(eq(medicalReports.imagingStudyId, id));

    const radiologistReport = buildImagingReportContext(study.radiologistReport, linkedReports);

    const systemPrompt = buildImagingSystemPrompt(study.modality);
    const userPrompt = buildImagingUserPrompt({
      modality: study.modality,
      bodyPart: study.bodyPart,
      studyDate: study.studyDate,
      radiologistReport,
      sybil,
      slices: usedSlices,
    });

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_VISION_MODEL,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    const parts = [
      ...pngBuffers.map((buffer) => ({
        inlineData: {
          mimeType: "image/png" as const,
          data: buffer.toString("base64"),
        },
      })),
      { text: userPrompt },
    ];

    const result = await model.generateContent(parts);
    const findings = result.response.text().trim();

    if (!findings) {
      return NextResponse.json({ error: "Gemini returned an empty response", success: false }, { status: 502 });
    }

    const runAt = new Date().toISOString();
    const manualCount = usedSlices.filter((s) => s.sources.includes("manual")).length;
    const sybilCount = usedSlices.filter((s) => s.sources.includes("sybil")).length;

    const meta = {
      sliceCount: usedSlices.length,
      manualCount,
      sybilCount,
      linkedReportCount: linkedReports.filter((r: (typeof linkedReports)[number]) => r.rawText?.trim() || r.aiSummary?.trim()).length,
      hasRadiologistReport: !!radiologistReport,
      provider: providerName,
      model: GEMINI_VISION_MODEL,
      runAt,
      conversionWarnings: conversionErrors,
    };

    await db
      .update(imagingStudies)
      .set({ aiFindings: findings })
      .where(eq(imagingStudies.id, id));

    return NextResponse.json({
      data: { findings, meta },
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("AI analyze error:", error);
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const { id } = await params;
  const [study] = await db.select({
    aiFindings: imagingStudies.aiFindings,
    patientId: imagingStudies.patientId,
  }).from(imagingStudies).where(eq(imagingStudies.id, id));

  if (!study || !(await canAccessPatient(study.patientId, userId, "viewer"))) {
    return NextResponse.json({ error: "Study not found", success: false }, { status: 404 });
  }

  return NextResponse.json({ data: { findings: study.aiFindings ?? null }, success: true });
}
