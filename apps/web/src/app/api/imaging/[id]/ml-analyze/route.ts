import { NextRequest, NextResponse } from "next/server";
import { db, imagingStudies, imagingSeries, imagingInstances } from "@/lib/db";
import { eq } from "drizzle-orm";
import { join } from "path";
import { checkMlService, getSybilJobStatus, startSybilJob } from "@/lib/ml/client";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";

export const maxDuration = 60;

async function loadInstances(studyId: string) {
  const series = await db.select().from(imagingSeries).where(eq(imagingSeries.studyId, studyId));
  const allInstances = series.length > 0
    ? (await Promise.all((series as { id: string }[]).map((s) =>
        db.select().from(imagingInstances).where(eq(imagingInstances.seriesId, s.id))
      ))).flat()
    : [];

  return allInstances.map((inst) => ({
    file_path: join(process.cwd(), "public", inst.filePath),
    instance_number: inst.instanceNumber,
  }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const seriesNumber = typeof body.seriesNumber === "number" ? body.seriesNumber : undefined;

  const available = await checkMlService();
  if (!available) {
    return NextResponse.json({
      error: "ML service is not running. Start it with: cd apps/ml-service && ./start.sh",
      success: false,
      serviceDown: true,
    }, { status: 503 });
  }

  const [study] = await db.select().from(imagingStudies).where(eq(imagingStudies.id, id));
  if (!study || !(await canAccessPatient(study.patientId, userId, "collaborator"))) {
    return NextResponse.json({ error: "Study not found", success: false }, { status: 404 });
  }

  if (study.modality !== "CT") {
    return NextResponse.json({
      error: `Sybil requires CT images. This study is ${study.modality}.`,
      success: false,
    }, { status: 400 });
  }

  const instances = await loadInstances(id);
  if (instances.length === 0) {
    return NextResponse.json({ error: "No DICOM instances found for this study", success: false }, { status: 400 });
  }

  try {
    const jobId = await startSybilJob(id, instances, seriesNumber);
    return NextResponse.json({ data: { jobId }, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const { id } = await params;
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (jobId) {
    const available = await checkMlService();
    if (!available) {
      return NextResponse.json({
        error: "ML service is not running",
        success: false,
        serviceDown: true,
      }, { status: 503 });
    }

    try {
      const job = await getSybilJobStatus(jobId);

      if (job.status === "completed" && job.result) {
        const [study] = await db
          .select()
          .from(imagingStudies)
          .where(eq(imagingStudies.id, id));
        if (study && (await canAccessPatient(study.patientId, userId, "collaborator"))) {
          const mlModelResults = {
            ...(study.mlModelResults as object ?? {}),
            sybil: {
              ...job.result,
              runAt: new Date().toISOString(),
            },
          };
          await db
            .update(imagingStudies)
            .set({ mlModelResults })
            .where(eq(imagingStudies.id, id));
        }
        return NextResponse.json({ data: { status: job.status, result: job.result }, success: true });
      }

      if (job.status === "failed") {
        return NextResponse.json({
          data: { status: job.status, error: job.error ?? "Sybil analysis failed" },
          success: false,
        }, { status: 500 });
      }

      return NextResponse.json({ data: { status: job.status }, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ error: message, success: false }, { status: 500 });
    }
  }

  const [study] = await db.select({
    id: imagingStudies.id,
    mlModelResults: imagingStudies.mlModelResults,
    patientId: imagingStudies.patientId,
  }).from(imagingStudies).where(eq(imagingStudies.id, id));

  if (!study || !(await canAccessPatient(study.patientId, userId, "viewer"))) {
    return NextResponse.json({ error: "Study not found", success: false }, { status: 404 });
  }

  return NextResponse.json({ data: study.mlModelResults ?? null, success: true });
}
