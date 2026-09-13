import { NextRequest, NextResponse } from "next/server";
import { db, imagingStudies, imagingSeries, imagingInstances } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { join } from "path";
import { checkMlService, getSegmentJobStatus, startSegmentJob } from "@/lib/ml/client";
import { getCurrentUserId } from "@/lib/auth/user";

export const maxDuration = 60;

async function loadInstances(studyId: string) {
  const series = await db.select().from(imagingSeries).where(eq(imagingSeries.studyId, studyId));
  const allInstances = series.length > 0
    ? (await Promise.all((series as { id: string }[]).map((s) =>
        db.select().from(imagingInstances).where(eq(imagingInstances.seriesId, s.id)),
      ))).flat()
    : [];

  return allInstances.map((inst) => ({
    file_path: join(process.cwd(), "public", inst.filePath),
    instance_number: inst.instanceNumber,
  }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const seriesNumber = typeof body.seriesNumber === "number" ? body.seriesNumber : undefined;
  const task = typeof body.task === "string" ? body.task : "total";

  const available = await checkMlService();
  if (!available) {
    return NextResponse.json({
      error: "ML service is not running. Start it with: cd apps/ml-service && ./start.sh",
      success: false,
      serviceDown: true,
    }, { status: 503 });
  }

  const [study] = await db
    .select()
    .from(imagingStudies)
    .where(and(eq(imagingStudies.id, id), eq(imagingStudies.userId, userId)));
  if (!study) {
    return NextResponse.json({ error: "Study not found", success: false }, { status: 404 });
  }

  if (study.modality !== "CT") {
    return NextResponse.json({
      error: `Anatomy segmentation requires CT. This study is ${study.modality}.`,
      success: false,
    }, { status: 400 });
  }

  const instances = await loadInstances(id);
  if (instances.length === 0) {
    return NextResponse.json({ error: "No DICOM instances found for this study", success: false }, { status: 400 });
  }

  try {
    const jobId = await startSegmentJob(id, instances, seriesNumber, task);
    return NextResponse.json({ data: { jobId }, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
      const job = await getSegmentJobStatus(jobId);

      if (job.status === "completed" && job.result) {
        const [study] = await db
          .select()
          .from(imagingStudies)
          .where(and(eq(imagingStudies.id, id), eq(imagingStudies.userId, userId)));
        if (study) {
          const mlModelResults = {
            ...(study.mlModelResults as object ?? {}),
            segmentation: {
              ...job.result,
              runAt: new Date().toISOString(),
            },
          };
          await db
            .update(imagingStudies)
            .set({ mlModelResults })
            .where(and(eq(imagingStudies.id, id), eq(imagingStudies.userId, userId)));
        }
        return NextResponse.json({ data: { status: job.status, result: job.result }, success: true });
      }

      if (job.status === "failed") {
        return NextResponse.json({
          data: { status: job.status, error: job.error ?? "Segmentation failed" },
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
    mlModelResults: imagingStudies.mlModelResults,
  }).from(imagingStudies).where(and(eq(imagingStudies.id, id), eq(imagingStudies.userId, userId)));

  if (!study) {
    return NextResponse.json({ error: "Study not found", success: false }, { status: 404 });
  }

  const seg = (study.mlModelResults as { segmentation?: unknown } | null)?.segmentation ?? null;
  return NextResponse.json({ data: seg, success: true });
}
