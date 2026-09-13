import { classifyMarkerStatus } from "@cancer-monitor/shared";
import type { MarkerStatus } from "@cancer-monitor/shared";
import type { ParsedBloodMarker } from "./parseBloodTestFile";

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function prepareBloodMarkersForSave(markers: ParsedBloodMarker[]) {
  return markers
    .map((m) => {
      const value = toNumber(m.value);
      if (!m.name?.trim() || value === undefined) return null;

      const referenceMin = toNumber(m.referenceMin);
      const referenceMax = toNumber(m.referenceMax);

      return {
        name: m.name.trim(),
        value,
        unit: m.unit?.trim() || "-",
        referenceMin,
        referenceMax,
        status: classifyMarkerStatus(value, referenceMin, referenceMax) as MarkerStatus,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
}
