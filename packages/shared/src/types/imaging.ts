export type ImagingModality = "CT" | "MRI" | "PET" | "XRAY" | "ULTRASOUND" | "OTHER";

export interface ImagingStudy {
  id: string;
  patientId: string;
  modality: ImagingModality;
  studyDate: string;
  bodyPart: string;
  description?: string;
  dicomPath?: string;
  thumbnailPath?: string;
  seriesCount: number;
  instanceCount: number;
  radiologistReport?: string;
  aiFindings?: string;
  createdAt: string;
}

export interface ImagingSeries {
  id: string;
  studyId: string;
  seriesNumber: number;
  description?: string;
  modality: ImagingModality;
  instanceCount: number;
  instances: ImagingInstance[];
}

export interface ImagingInstance {
  id: string;
  seriesId: string;
  instanceNumber: number;
  sopInstanceUid: string;
  filePath: string;
}
