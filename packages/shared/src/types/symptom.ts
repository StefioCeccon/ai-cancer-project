export type SymptomSeverity = "mild" | "moderate" | "severe";

export interface Symptom {
  id: string;
  patientId: string;
  name: string;
  severity?: SymptomSeverity | null;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
  rawText?: string | null;
  filePath?: string | null;
  sourceTitle?: string | null;
  createdAt: string;
}

export interface ParsedSymptomEntry {
  name: string;
  severity?: SymptomSeverity | null;
  startDate: string | null;
  endDate?: string | null;
  notes?: string | null;
}
