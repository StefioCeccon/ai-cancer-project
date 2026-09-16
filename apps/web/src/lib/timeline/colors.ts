import type { ReportType } from "@ai-cancer-project/shared";
import type { TimelineCategory } from "./types";

/** Category band colors (background tint) */
export const CATEGORY_COLORS: Record<TimelineCategory, string> = {
  blood_test: "#e11d48",
  imaging: "#2563eb",
  report: "#7c3aed",
  symptom: "#f43f5e",
  therapy: "#10b981",
};

/** Per-type dot / legend colors */
export const TYPE_COLORS: Record<string, string> = {
  blood_test: "#e11d48",
  symptom: "#f43f5e",
  therapy: "#10b981",
  therapy_chemotherapy: "#059669",
  therapy_immunotherapy: "#0d9488",
  therapy_radiation: "#d97706",
  therapy_surgery: "#6366f1",
  therapy_targeted_therapy: "#8b5cf6",
  therapy_hormone_therapy: "#ec4899",
  therapy_supportive_care: "#64748b",
  therapy_other: "#10b981",
  group_tomographies: "#0ea5e9",
  imaging_group_tomography: "#0ea5e9",
  group_radiography: "#64748b",
  imaging_group_radiography: "#64748b",
  imaging_group_ultrasound: "#14b8a6",
  imaging_group_other: "#94a3b8",
  report_category_angiology: "#0891b2",
  report_category_tomographies: "#0ea5e9",
  report_category_tomography: "#0ea5e9",
  report_category_radiography: "#64748b",
  report_category_radiology: "#64748b",
  report_category_ultrasound: "#14b8a6",
  report_category_orthopedics: "#84cc16",
  report_category_physiotherapy: "#84cc16",
  report_category_phisiotherapy: "#84cc16",
  report_visit_note: "#3b82f6",
  report_pathology: "#dc2626",
  report_radiology: "#06b6d4",
  report_discharge_summary: "#64748b",
  report_treatment_plan: "#22c55e",
  report_prescription: "#eab308",
  report_referral: "#a855f7",
  report_other: "#94a3b8",
};

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  visit_note: "Visit Note",
  pathology: "Pathology",
  radiology: "Radiology",
  discharge_summary: "Discharge Summary",
  treatment_plan: "Treatment Plan",
  prescription: "Prescription",
  referral: "Referral",
  other: "Other",
};

export function reportTypeKey(reportType: string): string {
  return `report_${reportType}`;
}

export function getTypeColor(typeKey: string, category: TimelineCategory): string {
  if (TYPE_COLORS[typeKey]) return TYPE_COLORS[typeKey];
  if (typeKey.startsWith("report_category_") || typeKey.startsWith("report_title_") || typeKey.startsWith("report_specialty_")) {
    return hashColor(typeKey);
  }
  return CATEGORY_COLORS[category];
}

function hashColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 52%, 42%)`;
}

export function getReportTypeLabel(reportType: string): string {
  return REPORT_TYPE_LABELS[reportType as ReportType] ?? reportType;
}

export function truncate(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}
