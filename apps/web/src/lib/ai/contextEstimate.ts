import { AI_MODELS } from "@ai-cancer-project/shared";
import type { AnalysisType } from "@ai-cancer-project/shared";

export interface ReportContextItem {
  id: string;
  title: string;
  reportType: string;
  reportDate: string;
  author?: string | null;
  institution?: string | null;
  rawText?: string | null;
  aiSummary?: string | null;
}

export interface BloodTestContextItem {
  id: string;
  testDate: string;
  labName?: string | null;
  markers: {
    name: string;
    value: number;
    unit: string;
    status: string;
    referenceMin?: number | null;
    referenceMax?: number | null;
    notes?: string | null;
  }[];
}

export interface ImagingContextItem {
  id: string;
  modality: string;
  bodyPart: string;
  studyDate: string;
  description?: string | null;
  radiologistReport?: string | null;
  aiFindings?: string | null;
  mlModelResults?: {
    sybil?: {
      risk_scores?: Record<string, number>;
      risk_level?: string;
      high_risk_instances?: number[];
      series_number?: number | string;
      slice_count?: number;
    };
  } | null;
}

const CHARS_PER_TOKEN = 4;
const OUTPUT_TOKEN_RESERVE = 8192;
const PROMPT_OVERHEAD_RESERVE = 3500;

export type ContextUsageLevel = "ok" | "warning" | "full";

export interface ContextEstimate {
  estimatedTokens: number;
  contextWindow: number;
  usableTokens: number;
  usagePercent: number;
  level: ContextUsageLevel;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function formatBloodTest(test: BloodTestContextItem): string {
  const markerLines = test.markers
    .map(
      (m) =>
        `  - ${m.name}: ${m.value} ${m.unit} [${m.status}]${m.referenceMin != null || m.referenceMax != null ? ` (ref: ${m.referenceMin ?? "?"}-${m.referenceMax ?? "?"})` : ""}${m.notes ? ` | ${m.notes}` : ""}`
    )
    .join("\n");
  return [
    `Blood test ${test.testDate}${test.labName ? ` (${test.labName})` : ""}:`,
    markerLines || "  No markers",
  ].join("\n");
}

function formatReport(report: ReportContextItem): string {
  return [
    `Report: ${report.title} [${report.reportType}] ${report.reportDate}`,
    report.author ? `Author: ${report.author}` : null,
    report.institution ? `Institution: ${report.institution}` : null,
    report.aiSummary ? `Summary: ${report.aiSummary}` : null,
    report.rawText ? `Content:\n${report.rawText}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatImaging(study: ImagingContextItem): string {
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

export function estimateAnalysisContext(opts: {
  model: string;
  analysisType: AnalysisType;
  bloodTests: BloodTestContextItem[];
  reports: ReportContextItem[];
  imagingStudies: ImagingContextItem[];
  strategyContext?: string;
  patientContextChars?: number;
}): ContextEstimate {
  const modelInfo = AI_MODELS[opts.model];
  const contextWindow = modelInfo?.contextWindow ?? 128_000;

  const sections: string[] = [];

  if (opts.analysisType !== "ml_imaging" && opts.bloodTests.length > 0) {
    sections.push(opts.bloodTests.map(formatBloodTest).join("\n\n"));
  }
  if (opts.analysisType !== "ml_imaging" && opts.reports.length > 0) {
    sections.push(opts.reports.map(formatReport).join("\n\n"));
  }
  if (opts.imagingStudies.length > 0) {
    sections.push(opts.imagingStudies.map(formatImaging).join("\n\n"));
  }
  if (opts.strategyContext?.trim()) {
    sections.push(`## Strategy Context\n${opts.strategyContext.trim()}`);
  }

  const dataTokens = estimateTokens(sections.join("\n\n"));
  const patientTokens = estimateTokens("x".repeat(opts.patientContextChars ?? 500));
  const estimatedTokens = dataTokens + patientTokens + PROMPT_OVERHEAD_RESERVE;
  const usableTokens = Math.max(contextWindow - OUTPUT_TOKEN_RESERVE, 1);
  const usagePercent = Math.min(100, Math.round((estimatedTokens / usableTokens) * 100));

  let level: ContextUsageLevel = "ok";
  if (usagePercent >= 90) level = "full";
  else if (usagePercent >= 70) level = "warning";

  return { estimatedTokens, contextWindow, usableTokens, usagePercent, level };
}

export function estimateItemTokens(
  type: "report" | "bloodTest" | "imaging",
  item: ReportContextItem | BloodTestContextItem | ImagingContextItem
): number {
  if (type === "report") return estimateTokens(formatReport(item as ReportContextItem));
  if (type === "bloodTest") return estimateTokens(formatBloodTest(item as BloodTestContextItem));
  return estimateTokens(formatImaging(item as ImagingContextItem));
}
