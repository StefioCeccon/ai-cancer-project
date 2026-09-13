import { NextRequest, NextResponse } from "next/server";
import { db, medicalReports, imagingStudies } from "@/lib/db";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { normalizeStoredTimelineCategory } from "@/lib/timeline/reportLanes";
import { classifyReportTimelineCategory } from "@/lib/upload/classifyReportTimelineCategory";
import { getCurrentUserId, isPatientOwnedBy } from "@/lib/auth/user";
import { runWithUserKeys } from "@/lib/ai/keyContext";

const createReportSchema = z.object({
  patientId: z.string().uuid(),
  reportType: z.enum([
    "visit_note",
    "pathology",
    "radiology",
    "discharge_summary",
    "treatment_plan",
    "prescription",
    "referral",
    "other",
  ]),
  reportDate: z.string().min(1),
  author: z.string().optional().nullable(),
  institution: z.string().optional().nullable(),
  title: z.string().min(1),
  rawText: z.string().optional().nullable(),
  aiSummary: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
});

const reportSelect = {
  id: medicalReports.id,
  patientId: medicalReports.patientId,
  imagingStudyId: medicalReports.imagingStudyId,
  reportType: medicalReports.reportType,
  reportDate: medicalReports.reportDate,
  author: medicalReports.author,
  institution: medicalReports.institution,
  title: medicalReports.title,
  rawText: medicalReports.rawText,
  filePath: medicalReports.filePath,
  extractedData: medicalReports.extractedData,
  aiSummary: medicalReports.aiSummary,
  clinicalSpecialty: medicalReports.clinicalSpecialty,
  createdAt: medicalReports.createdAt,
  linkedStudyModality: imagingStudies.modality,
  linkedStudyDate: imagingStudies.studyDate,
  linkedStudyBodyPart: imagingStudies.bodyPart,
};

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    const query = db
      .select(reportSelect)
      .from(medicalReports)
      .leftJoin(imagingStudies, eq(medicalReports.imagingStudyId, imagingStudies.id))
      .orderBy(desc(medicalReports.createdAt));

    const data = patientId
      ? await query.where(and(eq(medicalReports.userId, userId), eq(medicalReports.patientId, patientId)))
      : await query.where(eq(medicalReports.userId, userId));

    return NextResponse.json({ data, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    if (!(await isPatientOwnedBy(parsed.data.patientId, userId))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const category = await runWithUserKeys(userId, () =>
      classifyReportTimelineCategory({
        title: parsed.data.title,
        reportType: parsed.data.reportType,
      })
    );

    const [created] = await db
      .insert(medicalReports)
      .values({
        ...parsed.data,
        userId,
        clinicalSpecialty: normalizeStoredTimelineCategory(category) ?? "",
      })
      .returning();

    return NextResponse.json({ data: created, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
