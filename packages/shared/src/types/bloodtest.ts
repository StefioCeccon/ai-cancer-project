export type MarkerTrend = "increasing" | "decreasing" | "stable" | "unknown";
export type MarkerStatus = "normal" | "low" | "high" | "critical_low" | "critical_high";

export interface BloodMarker {
  name: string;
  value: number;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  status: MarkerStatus;
  trend?: MarkerTrend;
  notes?: string;
}

export interface BloodTest {
  id: string;
  patientId: string;
  testDate: string;
  labName?: string;
  requestingPhysician?: string;
  markers: BloodMarker[];
  rawText?: string;
  filePath?: string;
  aiInterpretation?: string;
  createdAt: string;
}

export interface BloodTestCreate {
  patientId: string;
  testDate: string;
  labName?: string;
  requestingPhysician?: string;
  markers: Omit<BloodMarker, "trend">[];
  rawText?: string;
  filePath?: string;
}

export const CANCER_MARKERS = [
  "CEA", "CA 19-9", "CA 125", "CA 15-3", "AFP", "PSA", "hCG",
  "LDH", "Beta-2 Microglobulin", "Chromogranin A",
] as const;

export type CancerMarkerName = typeof CANCER_MARKERS[number];
