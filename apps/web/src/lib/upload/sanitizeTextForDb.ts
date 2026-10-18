/**
 * Postgres `text` rejects NUL (0x00). OCR / PDF extractors sometimes emit them.
 * Strip before any insert/update of free-text fields.
 */
export function sanitizeTextForDb(value: string): string;
export function sanitizeTextForDb(value: string | null | undefined): string | null | undefined;
export function sanitizeTextForDb(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  // eslint-disable-next-line no-control-regex -- intentional: strip NUL for Postgres UTF-8
  return value.replace(/\u0000/g, "");
}
