import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db, imagingStudies, imagingSeries, imagingInstances } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";
import { putObject } from "@/lib/storage";

// DICOM magic bytes start at offset 128 ("DICM")
function isDicomBuffer(buf: Buffer): boolean {
  return buf.length > 132 &&
    buf[128] === 0x44 && buf[129] === 0x49 &&
    buf[130] === 0x43 && buf[131] === 0x4D; // "DICM"
}

interface DicomSliceMeta {
  hasPixels: boolean;
  seriesNumber: number;
  instanceNumber: number;
  seriesDescription: string;
}

// Parse pixel presence, series number, and instance number from a DICOM buffer.
// Stops parsing at 7FE0,0010 (pixel data) for speed.
function parseDicomSliceMeta(buf: Buffer): DicomSliceMeta {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dicomParser = require("dicom-parser");
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const dataset = dicomParser.parseDicom(bytes, { untilTag: "x7fe00010" });
    const pixelEl = dataset.elements["x7fe00010"];
    const hasPixels = !!pixelEl && (pixelEl.length > 0 || pixelEl.hadUndefinedLength);
    // 0020,0011 = Series Number, 0020,0013 = Instance Number, 0008,103E = Series Description
    const seriesNumber = parseInt(dataset.string("x00200011") ?? "0", 10) || 0;
    const instanceNumber = parseInt(dataset.string("x00200013") ?? "0", 10) || 0;
    const seriesDescription = (dataset.string("x0008103e") ?? "").trim();
    return { hasPixels, seriesNumber, instanceNumber, seriesDescription };
  } catch {
    return { hasPixels: false, seriesNumber: 0, instanceNumber: 0, seriesDescription: "" };
  }
}

async function getOrCreateSeries(
  studyId: string,
  seriesNumber: number,
  description: string,
  cache: Map<number, { id: string }>,
) {
  const cached = cache.get(seriesNumber);
  if (cached) return cached;

  const existing = await db
    .select({ id: imagingSeries.id })
    .from(imagingSeries)
    .where(and(eq(imagingSeries.studyId, studyId), eq(imagingSeries.seriesNumber, seriesNumber)));

  if (existing[0]) {
    cache.set(seriesNumber, existing[0]);
    return existing[0];
  }

  const [created] = await db.insert(imagingSeries).values({
    studyId,
    seriesNumber,
    description: description || `Series ${seriesNumber}`,
    modality: "CT",
    instanceCount: 0,
  }).returning({ id: imagingSeries.id });

  cache.set(seriesNumber, created);
  return created;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const formData = await req.formData();
    const studyId = formData.get("studyId") as string;
    const files = formData.getAll("files") as File[];

    if (!studyId || files.length === 0) {
      return NextResponse.json({ error: "studyId and files required", success: false }, { status: 400 });
    }

    const [study] = await db
      .select({ id: imagingStudies.id, patientId: imagingStudies.patientId })
      .from(imagingStudies)
      .where(eq(imagingStudies.id, studyId));

    if (!study || !(await canAccessPatient(study.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Study not found", success: false }, { status: 404 });
    }

    const seriesCache = new Map<number, { id: string }>();
    const instanceRecords = [];
    let skipped = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const bytes = await file.arrayBuffer();
      if (!bytes.byteLength) { skipped++; continue; }

      const buf = Buffer.from(bytes);

      if (!isDicomBuffer(buf)) { skipped++; continue; }

      const dicomMeta = parseDicomSliceMeta(buf);
      if (!dicomMeta.hasPixels) { skipped++; continue; }

      const series = await getOrCreateSeries(
        studyId,
        dicomMeta.seriesNumber,
        dicomMeta.seriesDescription,
        seriesCache,
      );

      const filename = `${i + 1}_${uuidv4()}.dcm`;
      const { path: filePath } = await putObject(
        `/uploads/dicom/${studyId}/${filename}`,
        buf,
        "application/dicom",
      );

      instanceRecords.push({
        seriesId: series.id,
        instanceNumber: dicomMeta.instanceNumber || instanceRecords.length + 1,
        filePath,
        sopInstanceUid: uuidv4(),
      });
    }

    if (instanceRecords.length === 0) {
      return NextResponse.json({
        error: `No image files found in batch (${skipped} non-image DICOM objects skipped)`,
        success: false,
      }, { status: 400 });
    }

    await db.insert(imagingInstances).values(instanceRecords);

    // Refresh per-series and study-level counts
    for (const series of seriesCache.values()) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(imagingInstances)
        .where(eq(imagingInstances.seriesId, series.id));
      await db.update(imagingSeries).set({ instanceCount: count }).where(eq(imagingSeries.id, series.id));
    }

    const studySeries = await db.select({ id: imagingSeries.id }).from(imagingSeries).where(eq(imagingSeries.studyId, studyId));
    const [{ totalInstances }] = await db
      .select({ totalInstances: sql<number>`count(*)::int` })
      .from(imagingInstances)
      .innerJoin(imagingSeries, eq(imagingInstances.seriesId, imagingSeries.id))
      .where(eq(imagingSeries.studyId, studyId));

    await db
      .update(imagingStudies)
      .set({ seriesCount: studySeries.length, instanceCount: totalInstances })
      .where(eq(imagingStudies.id, studyId));

    return NextResponse.json({
      success: true,
      data: {
        studyId,
        seriesCount: studySeries.length,
        instanceCount: instanceRecords.length,
        skipped,
      },
    });
  } catch (e) {
    console.error("DICOM upload error:", e);
    return NextResponse.json({ error: "Upload failed", success: false }, { status: 500 });
  }
}
