import { NextRequest } from "next/server";
import { z } from "zod";
import { userCanAccessPatientUploadPath } from "@/lib/storage/authorizeUploadPath";
import { fileFromStoredPath } from "./fileFromStoredPath";

const storedFilesSchema = z.object({
  patientId: z.string().uuid(),
  mode: z.string().optional().nullable(),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        fileName: z.string().min(1),
      })
    )
    .min(1),
});

export type ResolveParseFilesResult = {
  files: File[];
  mode: string | null;
  patientId: string | null;
};

/**
 * Accept either JSON `{ patientId, files: [{ path, fileName }], mode? }`
 * (preferred — bypasses Vercel 4.5 MB body limit after direct-to-R2 upload)
 * or legacy multipart FormData with `files` / `file`.
 */
export async function resolveParseUploadFiles(
  req: NextRequest,
  userId: string
): Promise<ResolveParseFilesResult | { error: string; status: number }> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    const parsed = storedFilesSchema.safeParse(body);
    if (!parsed.success) {
      return { error: "patientId and files[{ path, fileName }] are required", status: 400 };
    }

    const files: File[] = [];
    for (const entry of parsed.data.files) {
      const allowed = await userCanAccessPatientUploadPath(
        userId,
        parsed.data.patientId,
        entry.path,
        "collaborator"
      );
      if (!allowed) {
        return { error: "Forbidden", status: 403 };
      }
      files.push(await fileFromStoredPath(entry.path, entry.fileName));
    }

    return {
      files,
      mode: parsed.data.mode ?? null,
      patientId: parsed.data.patientId,
    };
  }

  const formData = await req.formData();
  const modeRaw = formData.get("mode");
  const mode = typeof modeRaw === "string" ? modeRaw : null;
  const many = formData.getAll("files").filter((f): f is File => f instanceof File);
  const single = formData.get("file");
  const files =
    many.length > 0
      ? many
      : single instanceof File
        ? [single]
        : [];

  if (!files.length) {
    return { error: "No files provided", status: 400 };
  }

  return { files, mode, patientId: null };
}
