export type TherapyType =
  | "chemotherapy"
  | "immunotherapy"
  | "radiation"
  | "surgery"
  | "targeted_therapy"
  | "hormone_therapy"
  | "supportive_care"
  | "other";

export interface TherapyMedication {
  id?: string;
  therapyId?: string;
  name: string;
  startDate?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  notes?: string | null;
}

export interface Therapy {
  id: string;
  patientId: string;
  name: string;
  therapyType: TherapyType;
  startDate: string;
  endDate?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  notes?: string | null;
  rawText?: string | null;
  filePath?: string | null;
  sourceTitle?: string | null;
  createdAt: string;
  medications?: TherapyMedication[];
}

export interface ParsedTherapyMedication {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  notes?: string | null;
}

export interface ParsedTherapyEntry {
  name: string;
  therapyType?: TherapyType | null;
  startDate: string | null;
  endDate?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  notes?: string | null;
  medications?: ParsedTherapyMedication[];
}
