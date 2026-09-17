import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { putObject } from "@/lib/storage";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";
import { sanitizeUploadType } from "@/lib/storage/authorizeUploadPath";

const metaSchema = z.object({
  patientId: z.string().uuid(),
  type: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const patientIdRaw = formData.get("patientId");
    const typeRaw = (formData.get("type") as string) ?? "misc";

    if (!file) {
      return NextResponse.json({ error: "No file provided", success: false }, { status: 400 });
    }

    const parsed = metaSchema.safeParse({
      patientId: typeof patientIdRaw === "string" ? patientIdRaw : "",
      type: typeRaw,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "patientId (uuid) is required", success: false },
        { status: 400 }
      );
    }

    if (!(await canAccessPatient(parsed.data.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Forbidden", success: false }, { status: 403 });
    }

    const type = sanitizeUploadType(parsed.data.type ?? "misc");
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = (file.name.split(".").pop() ?? "bin").replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const filename = `${uuidv4()}.${ext}`;
    // Namespace by patient so paths are attributable
    const { path } = await putObject(
      `/uploads/${type}/${parsed.data.patientId}/${filename}`,
      buffer,
      file.type
    );

    return NextResponse.json({
      success: true,
      data: {
        path,
        filename,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      },
    });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: "Upload failed", success: false }, { status: 500 });
  }
}
