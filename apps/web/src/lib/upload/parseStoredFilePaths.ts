/** Parse file paths stored on blood tests / reports (single path or JSON array). */
export function parseStoredFilePaths(filePath?: string | null): string[] {
  if (!filePath?.trim()) return [];

  try {
    const parsed = JSON.parse(filePath);
    if (Array.isArray(parsed)) {
      return parsed.filter((path): path is string => typeof path === "string" && path.length > 0);
    }
  } catch {
    // Stored as a plain path string.
  }

  return [filePath];
}
