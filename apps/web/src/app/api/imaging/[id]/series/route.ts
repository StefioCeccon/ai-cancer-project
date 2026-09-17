import { NextRequest, NextResponse } from "next/server";
import { db, imagingStudies, imagingSeries, imagingInstances } from "@/lib/db";
import { eq } from "drizzle-orm";
import { join } from "path";
import { checkMlService, listStudySeries } from "@/lib/ml/client";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const { id } = await params;

  const [study] = await db.select().from(imagingStudies).where(eq(imagingStudies.id, id));
  if (!study || !(await canAccessPatient(study.patientId, userId, "viewer"))) {
    return NextResponse.json({ error: "Study not found", success: false }, { status: 404 });
  }

  const available = await checkMlService();
  if (!available) {
    return NextResponse.json({
      error: "ML service is not running. Start it with: cd apps/ml-service && ./start.sh",
      success: false,
      serviceDown: true,
    }, { status: 503 });
  }

  const series = await db.select().from(imagingSeries).where(eq(imagingSeries.studyId, id));
  const allInstances = series.length > 0
    ? (await Promise.all((series as { id: string }[]).map((s) =>
        db.select().from(imagingInstances).where(eq(imagingInstances.seriesId, s.id))
      ))).flat()
    : [];

  if (allInstances.length === 0) {
    return NextResponse.json({ error: "No DICOM instances found", success: false }, { status: 400 });
  }

  const instances = allInstances.map((inst) => ({
    file_path: join(process.cwd(), "public", inst.filePath),
    instance_number: inst.instanceNumber,
  }));

  try {
    const result = await listStudySeries(instances);
    return NextResponse.json({ data: result, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
