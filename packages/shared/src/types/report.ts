export type ReportType =
  | "visit_note"
  | "pathology"
  | "radiology"
  | "discharge_summary"
  | "treatment_plan"
  | "prescription"
  | "referral"
  | "other";

export interface MedicalReport {
  id: string;
  patientId: string;
  reportType: ReportType;
  reportDate: string;
  author?: string;
  institution?: string;
  title: string;
  rawText?: string;
  filePath?: string;
  extractedData?: ReportExtractedData;
  aiSummary?: string;
  clinicalSpecialty?: string | null;
  createdAt: string;
}

export interface ReportExtractedData {
  diagnoses?: string[];
  medications?: string[];
  procedures?: string[];
  findings?: string[];
  recommendations?: string[];
  followUpDate?: string;
  keyValues?: Record<string, string>;
}

export interface MedicalReportCreate {
  patientId: string;
  reportType: ReportType;
  reportDate: string;
  author?: string;
  institution?: string;
  title: string;
  rawText?: string;
  filePath?: string;
}
