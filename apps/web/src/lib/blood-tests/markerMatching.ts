export const SODIUM_ALIASES = ["sodium", "na", "sodio", "natrium"];
export const POTASSIUM_ALIASES = ["potassium", "k", "potassio", "kalium"];
export const CALCIUM_ALIASES = ["calcium", "ca", "calcio"];
export const MAGNESIUM_ALIASES = ["magnesium", "mg", "magnesio"];
export const VITAMIN_D_ALIASES = ["vitamind", "vitd", "25ohd", "cholecalciferol", "calciferol"];
export const VITAMIN_B12_ALIASES = ["vitaminb12", "b12", "cobalamin", "cyanocobalamin", "vit.b12"];

function normalizeMarkerName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function markerMatchesAliases(name: string, aliases: string[]): boolean {
  const normalized = normalizeMarkerName(name);
  return aliases.some((alias) => {
    if (alias.length <= 2) return normalized === alias;
    return normalized === alias || normalized.includes(alias);
  });
}

export function findMarkerByAliases<T extends { name: string }>(
  markers: T[],
  aliases: string[]
): T | undefined {
  return markers.find((m) => markerMatchesAliases(m.name, aliases));
}

interface MarkerHistoryPoint {
  date: string;
  value: number;
  referenceMin?: number;
  referenceMax?: number;
  unit: string;
}

interface TestWithMarkers {
  testDate: string;
  markers: { name: string; value: number; unit: string; referenceMin?: number | null; referenceMax?: number | null }[];
}

export function getMarkerHistoryByAliases(
  tests: TestWithMarkers[],
  aliases: string[]
): MarkerHistoryPoint[] {
  return tests
    .map((test): MarkerHistoryPoint | null => {
      const marker = findMarkerByAliases(test.markers, aliases);
      if (!marker) return null;
      return {
        date: test.testDate,
        value: marker.value,
        unit: marker.unit,
        referenceMin: marker.referenceMin ?? undefined,
        referenceMax: marker.referenceMax ?? undefined,
      };
    })
    .filter((point): point is MarkerHistoryPoint => point !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}
