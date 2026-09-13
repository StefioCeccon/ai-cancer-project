export interface SybilRiskScores {
  "1yr": number;
  "2yr": number;
  "3yr": number;
  "4yr": number;
  "5yr": number;
  "6yr": number;
}

export interface SybilResultLike {
  // Only the 6-year score is consumed here; callers may carry the full set.
  risk_scores: { "6yr": number } & Partial<SybilRiskScores>;
  risk_level: "low" | "elevated" | "high";
  high_risk_instances: number[];
  high_risk_file_paths?: string[];
  heatmap_by_file?: Record<string, string>;
  series_number?: number;
}

/** Sybil attention highlights mapped for the DICOM viewer stack. */
export interface SybilViewerOverlay {
  seriesNumber: number;
  /** Basenames of DICOM files Sybil flagged (preferred — order-independent). */
  highRiskFileNames: string[];
  /** Fallback 0-based indices when file paths are unavailable. */
  highRiskStackIndices: number[];
  /** DICOM basename -> web path for per-slice attention heatmap PNG. */
  heatmapByFileName: Record<string, string>;
  riskLevel: "low" | "elevated" | "high";
  riskScore6yr: number;
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function sybilResultToViewerOverlay(result: SybilResultLike): SybilViewerOverlay | null {
  if (result.series_number == null) return null;
  return {
    seriesNumber: Number(result.series_number),
    highRiskFileNames: (result.high_risk_file_paths ?? []).map(basename),
    highRiskStackIndices: (result.high_risk_instances ?? []).map((n) => n - 1),
    heatmapByFileName: result.heatmap_by_file ?? {},
    riskLevel: result.risk_level,
    riskScore6yr: result.risk_scores["6yr"],
  };
}

/** Resolve heatmap web path for a file in the viewer stack. */
export function resolveHeatmapUrl(
  overlay: SybilViewerOverlay,
  filePath: string,
): string | null {
  const name = basename(filePath);
  return overlay.heatmapByFileName[name] ?? null;
}

/** Map Sybil highlights onto the viewer's current file stack. */
export function resolveHighRiskStackIndices(
  overlay: SybilViewerOverlay,
  filePaths: string[],
): number[] {
  if (overlay.highRiskFileNames.length > 0) {
    const names = new Set(overlay.highRiskFileNames);
    return filePaths
      .map((p, i) => (names.has(basename(p)) ? i : -1))
      .filter((i) => i >= 0);
  }
  return overlay.highRiskStackIndices.filter((i) => i >= 0 && i < filePaths.length);
}

export const overlayRiskBadgeColors: Record<string, string> = {
  low: "bg-green-600/90 text-white",
  elevated: "bg-orange-500/90 text-white",
  high: "bg-red-600/90 text-white",
};
