import type { BloodMarker, MarkerStatus } from "../types/bloodtest";

export function classifyMarkerStatus(
  value: number,
  min?: number,
  max?: number
): MarkerStatus {
  if (min === undefined && max === undefined) return "normal";
  if (min !== undefined && value < min * 0.8) return "critical_low";
  if (max !== undefined && value > max * 1.5) return "critical_high";
  if (min !== undefined && value < min) return "low";
  if (max !== undefined && value > max) return "high";
  return "normal";
}

export function markerStatusColor(status: MarkerStatus): string {
  switch (status) {
    case "normal": return "text-green-600";
    case "low": return "text-yellow-600";
    case "high": return "text-orange-600";
    case "critical_low": return "text-red-700";
    case "critical_high": return "text-red-700";
  }
}

export function markerStatusBg(status: MarkerStatus): string {
  switch (status) {
    case "normal": return "bg-green-50 border-green-200";
    case "low": return "bg-yellow-50 border-yellow-200";
    case "high": return "bg-orange-50 border-orange-200";
    case "critical_low": return "bg-red-50 border-red-300";
    case "critical_high": return "bg-red-50 border-red-300";
  }
}

export function computeTrend(history: number[]): "increasing" | "decreasing" | "stable" {
  if (history.length < 2) return "stable";
  const first = history[0];
  const last = history[history.length - 1];
  const delta = (last - first) / Math.abs(first || 1);
  if (delta > 0.05) return "increasing";
  if (delta < -0.05) return "decreasing";
  return "stable";
}
