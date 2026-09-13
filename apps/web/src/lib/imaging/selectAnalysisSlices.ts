import { buildSeriesGroups } from "@/lib/imaging/series";
import {
  resolveHighRiskStackIndices,
  sybilResultToViewerOverlay,
  type SybilResultLike,
} from "@/lib/imaging/sybil";

export type SliceSource = "manual" | "sybil";

export interface DbInstanceRow {
  id: string;
  seriesId: string;
  instanceNumber: number;
  filePath: string;
  flaggedForAI: boolean;
}

export interface DbSeriesRow {
  id: string;
  seriesNumber: number;
  description: string | null;
}

export interface AnalysisSlice {
  instanceId: string;
  filePath: string;
  instanceNumber: number;
  seriesNumber: number;
  seriesDescription: string | null;
  sources: SliceSource[];
}

export interface SelectAnalysisSlicesOptions {
  instances: DbInstanceRow[];
  series: DbSeriesRow[];
  sybil?: SybilResultLike | null;
  includeManualFlags?: boolean;
  includeMlHighlights?: boolean;
  maxSlices?: number;
}

const DEFAULT_MAX_SLICES = 12;

function seriesNumberById(series: DbSeriesRow[]): Map<string, DbSeriesRow> {
  return new Map(series.map((s) => [s.id, s]));
}

export function selectAnalysisSlices(opts: SelectAnalysisSlicesOptions): AnalysisSlice[] {
  const {
    instances,
    series,
    sybil,
    includeManualFlags = true,
    includeMlHighlights = true,
    maxSlices = DEFAULT_MAX_SLICES,
  } = opts;

  const seriesMap = seriesNumberById(series);
  const byId = new Map<string, AnalysisSlice>();

  function upsert(inst: DbInstanceRow, source: SliceSource) {
    const meta = seriesMap.get(inst.seriesId);
    const existing = byId.get(inst.id);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }

    byId.set(inst.id, {
      instanceId: inst.id,
      filePath: inst.filePath,
      instanceNumber: inst.instanceNumber,
      seriesNumber: meta?.seriesNumber ?? 0,
      seriesDescription: meta?.description ?? null,
      sources: [source],
    });
  }

  if (includeManualFlags) {
    for (const inst of instances) {
      if (inst.flaggedForAI) upsert(inst, "manual");
    }
  }

  if (includeMlHighlights && sybil?.series_number != null) {
    const overlay = sybilResultToViewerOverlay(sybil);
    if (overlay) {
      const groups = buildSeriesGroups(series, instances);
      const group = groups.find((g) => g.seriesNumber === overlay.seriesNumber);

      if (group) {
        const stackIndices = resolveHighRiskStackIndices(overlay, group.filePaths);
        for (const idx of stackIndices) {
          const instRef = group.instances[idx];
          if (!instRef) continue;
          const inst = instances.find((i) => i.id === instRef.id);
          if (inst) upsert(inst, "sybil");
        }
      }
    }
  }

  const manual = [...byId.values()].filter((s) => s.sources.includes("manual"));
  const sybilOnly = [...byId.values()].filter(
    (s) => s.sources.includes("sybil") && !s.sources.includes("manual"),
  );

  return [...manual, ...sybilOnly].slice(0, maxSlices);
}
