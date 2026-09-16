import type { ImagingAnalysisSummary } from "@ai-cancer-project/shared";

interface SybilMlResult {
  risk_scores?: Record<string, number>;
  risk_level?: string;
  high_risk_instances?: number[];
  series_number?: number | string;
  slice_count?: number;
  runAt?: string;
}

interface StudyWithMl {
  id: string;
  modality: string;
  bodyPart: string;
  studyDate: string;
  description?: string | null;
  radiologistReport?: string | null;
  aiFindings?: string | null;
  mlModelResults?: { sybil?: SybilMlResult } | null;
}

export function buildImagingAnalysisSummary(study: StudyWithMl): ImagingAnalysisSummary | null {
  const sybil = study.mlModelResults?.sybil;
  const flaggedFindings: string[] = [];

  if (study.aiFindings?.trim()) {
    flaggedFindings.push(study.aiFindings.trim());
  }

  if (!sybil && flaggedFindings.length === 0 && !study.radiologistReport) {
    return null;
  }

  const risk5yr = sybil?.risk_scores?.["5yr"];
  const risk6yr = sybil?.risk_scores?.["6yr"];

  return {
    studyId: study.id,
    modality: study.modality,
    bodyPart: study.bodyPart,
    studyDate: study.studyDate,
    mlModel: sybil ? "Sybil" : undefined,
    riskScore: risk6yr ?? risk5yr,
    riskScoreLabel: risk6yr != null ? "6-year lung cancer risk" : risk5yr != null ? "5-year lung cancer risk" : undefined,
    riskLevel: sybil?.risk_level,
    highRiskSlices: sybil?.high_risk_instances,
    seriesNumber: sybil?.series_number != null ? Number(sybil.series_number) : undefined,
    flaggedFindings,
    linkedReportSummary: study.radiologistReport?.trim() || undefined,
  };
}

export function formatMlImagingContext(study: StudyWithMl): string {
  const lines = [`Study: ${study.modality} ${study.bodyPart} — ${study.studyDate}`];
  if (study.description?.trim()) lines.push(`Description: ${study.description.trim()}`);

  const sybil = study.mlModelResults?.sybil;
  if (sybil) {
    lines.push("", "## ML Imaging Analysis");
    lines.push("Model: Sybil (lung cancer risk from CT)");
    if (sybil.risk_scores?.["5yr"] != null) {
      lines.push(`5-year lung cancer risk: ${(sybil.risk_scores["5yr"] * 100).toFixed(1)}%`);
    }
    if (sybil.risk_scores?.["6yr"] != null) {
      lines.push(`6-year lung cancer risk: ${(sybil.risk_scores["6yr"] * 100).toFixed(1)}% (${sybil.risk_level ?? "unknown"})`);
    }
    if (sybil.series_number != null) lines.push(`Analyzed series: ${sybil.series_number}`);
    if (sybil.high_risk_instances?.length) {
      lines.push(`High-attention slices (stack positions): ${sybil.high_risk_instances.join(", ")}`);
    }
    if (sybil.slice_count != null) lines.push(`Slices analyzed: ${sybil.slice_count}`);
  }

  if (study.radiologistReport?.trim()) {
    lines.push("", "Linked radiology report:", study.radiologistReport.trim());
  }

  if (study.aiFindings?.trim()) {
    lines.push("", "AI slice analysis (Gemini on flagged/high-attention slices):", study.aiFindings.trim());
  }

  return lines.join("\n");
}
