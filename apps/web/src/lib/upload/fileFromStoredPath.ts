import { getObjectBytes } from "@/lib/storage";
import { guessMimeType } from "./guessMimeType";

/** Load a stored upload into a `File` for existing parse helpers. */
export async function fileFromStoredPath(
  webPath: string,
  fileName?: string
): Promise<File> {
  const bytes = await getObjectBytes(webPath);
  const name = fileName || webPath.split("/").pop() || "file";
  const type = guessMimeType(name);
  // Copy into a fresh ArrayBuffer-backed view — Node Buffer is not always a valid BlobPart.
  const copy = Uint8Array.from(bytes);
  return new File([copy], name, { type });
}
