import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { MAX_FILE_SIZE_MB } from "@ai-cancer-project/shared";
import { createPresignedUploadUrl, storageBackend } from "@/lib/storage";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";
import { db, imagingStudies } from "@/lib/db";
import { eq } from "drizzle-orm";

const bodySchema = z.object({
  studyId: z.string().uuid(),
  fileName: z.string().min(1).max(512).optional(),
  contentType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  /** When true, only report storage backend (no signed URL). */
  probeOnly: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "studyId is required", success: false }, { status: 400 });
    }

    const [study] = await db
      .select({ id: imagingStudies.id, patientId: imagingStudies.patientId })
      .from(imagingStudies)
      .where(eq(imagingStudies.id, parsed.data.studyId));

    if (!study || !(await canAccessPatient(study.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Study not found", success: false }, { status: 404 });
    }

    if (
      typeof parsed.data.size === "number" &&
      parsed.data.size > MAX_FILE_SIZE_MB * 1024 * 1024
    ) {
      return NextResponse.json(
        { error: `File exceeds ${MAX_FILE_SIZE_MB} MB limit`, success: false },
        { status: 400 }
      );
    }

    if (storageBackend !== "r2") {
      return NextResponse.json({ success: true, backend: "local" as const });
    }

    if (parsed.data.probeOnly) {
      return NextResponse.json({ success: true, backend: "r2" as const });
    }

    const contentType = parsed.data.contentType?.trim() || "application/dicom";
    const filename = `${uuidv4()}.dcm`;
    const path = `/uploads/dicom/${study.id}/${filename}`;
    const { uploadUrl } = await createPresignedUploadUrl(path, contentType);

    return NextResponse.json({
      success: true,
      backend: "r2" as const,
      uploadUrl,
      path,
      contentType,
    });
  } catch (e) {
    console.error("Imaging presign error:", e);
    return NextResponse.json({ error: "Failed to prepare upload", success: false }, { status: 500 });
  }
}
