import { readApiError } from "./readApiError";
import { guessMimeType } from "./guessMimeType";

export type UploadedPatientFile = {
  path: string;
  fileName: string;
  size: number;
  mimeType: string;
};

/**
 * Upload a patient file, preferring direct-to-R2 via a short-lived presigned
 * PUT (avoids Vercel's 4.5 MB function body limit). Falls back to `/api/upload`
 * when R2 is not configured (local disk).
 */
export async function uploadPatientFile(
  file: File,
  opts: { patientId: string; type: string }
): Promise<UploadedPatientFile> {
  const contentType = file.type || guessMimeType(file.name);

  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientId: opts.patientId,
      type: opts.type,
      fileName: file.name,
      contentType,
      size: file.size,
    }),
  });

  if (!presignRes.ok) {
    throw new Error(await readApiError(presignRes, `Failed to prepare upload for "${file.name}"`));
  }

  const presign = (await presignRes.json()) as {
    backend?: "r2" | "local";
    uploadUrl?: string;
    path?: string;
  };

  if (presign.backend === "r2" && presign.uploadUrl && presign.path) {
    const putRes = await fetch(presign.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });
    if (!putRes.ok) {
      throw new Error(`Failed to upload "${file.name}" to storage (${putRes.status})`);
    }
    return {
      path: presign.path,
      fileName: file.name,
      size: file.size,
      mimeType: contentType,
    };
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("type", opts.type);
  fd.append("patientId", opts.patientId);
  const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
  if (!uploadRes.ok) {
    throw new Error(await readApiError(uploadRes, `Failed to upload "${file.name}"`));
  }
  const uploadData = await uploadRes.json();
  const path = uploadData.data?.path as string | undefined;
  if (!path) {
    throw new Error(`Upload succeeded but no path returned for "${file.name}"`);
  }
  return {
    path,
    fileName: file.name,
    size: file.size,
    mimeType: contentType,
  };
}
