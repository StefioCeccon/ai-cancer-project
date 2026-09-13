import { NextRequest, NextResponse } from "next/server";
import { db, medicalReports, imagingStudies } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";
import { normalizeStoredTimelineCategory } from "@/lib/timeline/reportLanes";
import { classifyReportTimelineCategory } from "@/lib/upload/classifyReportTimelineCategory";
import { runWithUserKeys } from "@/lib/ai/keyContext";

const reportTypeSchema = z.enum([
  "visit_note",
  "pathology",
  "radiology",
  "discharge_summary",
  "treatment_plan",
  "prescription",
  "referral",
  "other",
]);

const patchSchema = z.object({
  imagingStudyId: z.string().uuid().nullable().optional(),
  reportType: reportTypeSchema.optional(),
  reportDate: z.string().min(1).optional(),
  author: z.string().optional().nullable(),
  institution: z.string().optional().nullable(),
  title: z.string().min(1).optional(),
  rawText: z.string().optional().nullable(),
  aiSummary: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  clinicalSpecialty: z.string().nullable().optional(),
  timelineCategoryManual: z.boolean().optional(),
  resetTimelineCategory: z.boolean().optional(),
});

function mergeExtractedData(
  existing: unknown,
  patch: { timelineCategoryManual?: boolean }
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (patch.timelineCategoryManual !== undefined) {
    base.timelineCategoryManual = patch.timelineCategoryManual;
  }
  return base;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const [report] = await db
      .select()
      .from(medicalReports)
      .where(and(eq(medicalReports.id, id), eq(medicalReports.userId, userId)));

    if (!report) {
      return NextResponse.json({ error: "Report not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: report, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors, success: false }, { status: 400 });
    }

    const [existing] = await db.select().from(medicalReports).where(and(eq(medicalReports.id, id), eq(medicalReports.userId, userId)));
    if (!existing) {
      return NextResponse.json({ error: "Report not found", success: false }, { status: 404 });
    }

    // Prevent linking a report to another tenant's imaging study.
    if (parsed.data.imagingStudyId) {
      const [study] = await db
        .select({ id: imagingStudies.id })
        .from(imagingStudies)
        .where(and(eq(imagingStudies.id, parsed.data.imagingStudyId), eq(imagingStudies.userId, userId)));
      if (!study) {
        return NextResponse.json({ error: "Imaging study not found", success: false }, { status: 404 });
      }
    }

    const {
      resetTimelineCategory,
      timelineCategoryManual,
      clinicalSpecialty,
      ...reportFields
    } = parsed.data;

    const updates: Record<string, unknown> = { ...reportFields };

    const manualFlag = (existing.extractedData as { timelineCategoryManual?: boolean } | null)
      ?.timelineCategoryManual;

    if (resetTimelineCategory) {
      updates.clinicalSpecialty =
        normalizeStoredTimelineCategory(
          await runWithUserKeys(userId, () =>
            classifyReportTimelineCategory({
              title: (reportFields.title as string | undefined) ?? existing.title,
              reportType: (reportFields.reportType as string | undefined) ?? existing.reportType,
            })
          )
        ) ?? "";
      updates.extractedData = mergeExtractedData(existing.extractedData, {
        timelineCategoryManual: false,
      });
    } else if (clinicalSpecialty !== undefined) {
      updates.clinicalSpecialty = normalizeStoredTimelineCategory(clinicalSpecialty) ?? "";
      updates.extractedData = mergeExtractedData(existing.extractedData, {
        timelineCategoryManual: timelineCategoryManual ?? true,
      });
    } else if (
      !manualFlag &&
      (reportFields.title !== undefined || reportFields.reportType !== undefined)
    ) {
      updates.clinicalSpecialty =
        normalizeStoredTimelineCategory(
          await runWithUserKeys(userId, () =>
            classifyReportTimelineCategory({
              title: (reportFields.title as string | undefined) ?? existing.title,
              reportType: (reportFields.reportType as string | undefined) ?? existing.reportType,
            })
          )
        ) ?? "";
    }

    const [updated] = await db
      .update(medicalReports)
      .set(updates)
      .where(and(eq(medicalReports.id, id), eq(medicalReports.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Report not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const [deleted] = await db
      .delete(medicalReports)
      .where(and(eq(medicalReports.id, id), eq(medicalReports.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Report not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: deleted, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
