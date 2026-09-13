export type TimelineCategory = "blood_test" | "imaging" | "report" | "symptom" | "therapy";

export interface TimelineEvent {
  id: string;
  category: TimelineCategory;
  /** Stable key for grouping, coloring, and filtering (e.g. imaging_CT, report_pathology) */
  typeKey: string;
  typeLabel: string;
  date: string;
  /** When set, event spans from date to endDate on the timeline */
  endDate?: string | null;
  title: string;
  summary: string;
  detailHref?: string;
  meta?: {
    labName?: string | null;
    markerCount?: number;
    abnormalCount?: number;
    modality?: string;
    bodyPart?: string;
    imagingGroup?: string;
    reportType?: string;
    author?: string | null;
    institution?: string | null;
    category?: string;
    timelineCategoryManual?: boolean;
    severity?: string | null;
    therapyType?: string;
    dosage?: string | null;
    frequency?: string | null;
    medicationCount?: number;
    medicationNames?: string[];
  };
}

export interface TimelineLane {
  typeKey: string;
  typeLabel: string;
  category: TimelineCategory;
  color: string;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  lanes: TimelineLane[];
}
