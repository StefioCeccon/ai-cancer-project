import { readApiError } from "./readApiError";

const DICOM_CONTENT_TYPE = "application/dicom";
const BATCH = 5;

async function probeBackend(studyId: string): Promise<"r2" | "local"> {
  const res = await fetch("/api/imaging/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studyId, probeOnly: true }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to prepare DICOM upload"));
  }
  const data = (await res.json()) as { backend?: "r2" | "local" };
  return data.backend === "r2" ? "r2" : "local";
}

async function putFileToR2(file: File, studyId: string): Promise<string> {
  const presignRes = await fetch("/api/imaging/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studyId,
      fileName: file.name || "slice.dcm",
      contentType: DICOM_CONTENT_TYPE,
      size: file.size,
    }),
  });
  if (!presignRes.ok) {
    throw new Error(await readApiError(presignRes, `Failed to prepare upload for "${file.name}"`));
  }
  const presign = (await presignRes.json()) as {
    uploadUrl?: string;
    path?: string;
    contentType?: string;
  };
  if (!presign.uploadUrl || !presign.path) {
    throw new Error(`Invalid presign response for "${file.name}"`);
  }

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": presign.contentType || DICOM_CONTENT_TYPE },
  });
  if (!putRes.ok) {
    throw new Error(`Failed to upload "${file.name}" to storage (${putRes.status})`);
  }
  return presign.path;
}

/**
 * Upload DICOM slices for a study. On R2, each file goes browser → R2 via
 * presigned PUT, then a small JSON register call tells the API the paths.
 * Locally (no R2), files still go through `/api/imaging/upload` FormData.
 */
export async function uploadDicomFiles(
  files: File[],
  studyId: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ instanceCount: number; skipped: number }> {
  if (!files.length) {
    throw new Error("No files to upload");
  }

  const backend = await probeBackend(studyId);
  let registered = 0;
  let skipped = 0;

  if (backend === "r2") {
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH);
      const paths = await Promise.all(batch.map((file) => putFileToR2(file, studyId)));

      const res = await fetch("/api/imaging/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId,
          files: paths.map((path) => ({ path })),
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to register uploaded DICOM files"));
      }
      const data = await res.json();
      registered += data.data?.instanceCount ?? 0;
      skipped += data.data?.skipped ?? 0;
      onProgress?.(Math.min(i + batch.length, files.length), files.length);
    }
    return { instanceCount: registered, skipped };
  }

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const formData = new FormData();
    formData.append("studyId", studyId);
    batch.forEach((f) => formData.append("files", f));
    const uploadRes = await fetch("/api/imaging/upload", { method: "POST", body: formData });
    if (!uploadRes.ok) {
      throw new Error(await readApiError(uploadRes, "Failed to upload files"));
    }
    const data = await uploadRes.json();
    registered += data.data?.instanceCount ?? 0;
    skipped += data.data?.skipped ?? 0;
    onProgress?.(Math.min(i + batch.length, files.length), files.length);
  }

  return { instanceCount: registered, skipped };
}
