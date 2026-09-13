import { NextRequest, NextResponse } from "next/server";
import { db, imagingStudies, imagingSeries, imagingInstances, medicalReports } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { buildSeriesGroups } from "@/lib/imaging/series";
import { getCurrentUserId } from "@/lib/auth/user";

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
    const [study] = await db
      .select()
      .from(imagingStudies)
      .where(and(eq(imagingStudies.id, id), eq(imagingStudies.userId, userId)));

    if (!study) {
      return NextResponse.json({ error: "Imaging study not found", success: false }, { status: 404 });
    }

    // Fetch series + instances to get file paths for the viewer
    const series = await db.select().from(imagingSeries).where(eq(imagingSeries.studyId, id));
    const allInstances = series.length > 0
      ? (await Promise.all((series as { id: string }[]).map((s) =>
          db.select().from(imagingInstances).where(eq(imagingInstances.seriesId, s.id))
        ))).flat()
      : [];

    const filePaths = allInstances
      .sort((a, b) => a.instanceNumber - b.instanceNumber)
      .map((i) => i.filePath);

    const seriesGroups = buildSeriesGroups(series, allInstances);

    const linkedReports = await db
      .select({
        id: medicalReports.id,
        title: medicalReports.title,
        reportType: medicalReports.reportType,
        reportDate: medicalReports.reportDate,
        author: medicalReports.author,
        rawText: medicalReports.rawText,
        aiSummary: medicalReports.aiSummary,
      })
      .from(medicalReports)
      .where(and(eq(medicalReports.userId, userId), eq(medicalReports.imagingStudyId, id)));

    const linkedReportsForClient = linkedReports.map(({ rawText, aiSummary, ...rest }: (typeof linkedReports)[number]) => ({
      ...rest,
      hasContent: !!(rawText?.trim() || aiSummary?.trim()),
    }));

    return NextResponse.json({ data: { ...study, filePaths, seriesGroups, linkedReports: linkedReportsForClient }, success: true });
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
      .delete(imagingStudies)
      .where(and(eq(imagingStudies.id, id), eq(imagingStudies.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Imaging study not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: deleted, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
