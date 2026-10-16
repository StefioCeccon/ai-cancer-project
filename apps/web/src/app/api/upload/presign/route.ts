import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { MAX_FILE_SIZE_MB } from "@ai-cancer-project/shared";
import { createPresignedUploadUrl, storageBackend } from "@/lib/storage";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";
import { sanitizeUploadType } from "@/lib/storage/authorizeUploadPath";
import { guessMimeType } from "@/lib/upload/guessMimeType";

const bodySchema = z.object({
  patientId: z.string().uuid(),
  type: z.string().optional(),
  fileName: z.string().min(1).max(512),
  contentType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
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
      return NextResponse.json(
        { error: "patientId and fileName are required", success: false },
        { status: 400 }
      );
    }

    if (!(await canAccessPatient(parsed.data.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Forbidden", success: false }, { status: 403 });
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

    const type = sanitizeUploadType(parsed.data.type ?? "misc");
    const ext =
      (parsed.data.fileName.split(".").pop() ?? "bin").replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const filename = `${uuidv4()}.${ext}`;
    const path = `/uploads/${type}/${parsed.data.patientId}/${filename}`;
    const contentType =
      parsed.data.contentType?.trim() || guessMimeType(parsed.data.fileName);

    const { uploadUrl } = await createPresignedUploadUrl(path, contentType);

    return NextResponse.json({
      success: true,
      backend: "r2" as const,
      uploadUrl,
      path,
      contentType,
    });
  } catch (e) {
    console.error("Presign error:", e);
    return NextResponse.json({ error: "Failed to prepare upload", success: false }, { status: 500 });
  }
}
