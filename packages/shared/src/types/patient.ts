export type Gender = "male" | "female" | "other";

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  email?: string;
  phone?: string;
  diagnosisDate?: string;
  cancerType?: string;
  cancerStage?: string;
  primaryPhysician?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientCreate {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  email?: string;
  phone?: string;
  diagnosisDate?: string;
  cancerType?: string;
  cancerStage?: string;
  primaryPhysician?: string;
  notes?: string;
}
