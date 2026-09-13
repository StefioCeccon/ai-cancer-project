/** Number of source pages combined in parsed report text (bulk uploads join with ---). */
export function countDocumentPages(rawText?: string | null): number {
  if (!rawText?.trim()) return 0;
  const parts = rawText.split("\n\n---\n\n").filter((part) => part.trim());
  return parts.length || 1;
}
