// Client-safe blood-marker types and helpers. Kept separate from
// parseBloodTestFile.ts so client components can use them without pulling the
// server-only AI/DB chain into the browser bundle.

export interface ParsedBloodMarker {
  name: string;
  value: number;
  unit: string;
  referenceMin?: number | null;
  referenceMax?: number | null;
}

/** Merge markers from multiple pages, keeping the last value for duplicate names. */
export function mergeBloodMarkers(pages: ParsedBloodMarker[][]): ParsedBloodMarker[] {
  const map = new Map<string, ParsedBloodMarker>();
  for (const page of pages) {
    for (const marker of page) {
      map.set(marker.name.toLowerCase(), marker);
    }
  }
  return [...map.values()];
}
