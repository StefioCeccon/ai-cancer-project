const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8001";

export async function checkMlService(): Promise<boolean> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface SybilInstance {
  file_path: string;
  instance_number: number;
}

export interface StudySeriesInfo {
  series_number: number;
  slice_count: number;
  description: string;
  image_type: string;
  slice_thickness_mm: number | null;
  sybil_suitable: boolean;
  unsuitability_reason: string | null;
}

export interface StudySeriesResult {
  series: StudySeriesInfo[];
  recommended_series_number: number | null;
}

export interface SybilResult {
  study_id: string;
  model: string;
  risk_scores: { "1yr": number; "2yr": number; "3yr": number; "4yr": number; "5yr": number; "6yr": number };
  risk_level: "low" | "elevated" | "high";
  high_risk_instances: number[];
  high_risk_file_paths?: string[];
  heatmap_by_file?: Record<string, string>;
  slice_count: number;
  processing_time_seconds: number;
  series_number?: number;
  slice_thickness_mm?: number;
  excluded_slice_count?: number;
}

export async function listStudySeries(instances: SybilInstance[]): Promise<StudySeriesResult> {
  const res = await fetch(`${ML_SERVICE_URL}/study/series`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instances }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `ML service error: ${res.status}`);
  }

  return res.json();
}

export async function startSybilJob(
  studyId: string,
  instances: SybilInstance[],
  seriesNumber?: number,
): Promise<string> {
  const res = await fetch(`${ML_SERVICE_URL}/analyze/sybil/async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      study_id: studyId,
      instances,
      series_number: seriesNumber,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `ML service error: ${res.status}`);
  }

  const data = await res.json();
  return data.job_id as string;
}

export async function getSybilJobStatus(jobId: string): Promise<{
  status: string;
  result: SybilResult | null;
  error: string | null;
}> {
  const res = await fetch(`${ML_SERVICE_URL}/analyze/sybil/jobs/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `ML service error: ${res.status}`);
  }
  const data = await res.json();
  return {
    status: data.status,
    result: data.result ?? null,
    error: data.error ?? null,
  };
}

export interface SegmentResult {
  study_id: string;
  model: string;
  task: string;
  series_number?: number;
  slice_count: number;
  processing_time_seconds: number;
  labels: Record<string, string>;
  mask_by_file: Record<string, string>;
  labels_on_slice: Record<string, number[]>;
}

export async function startSegmentJob(
  studyId: string,
  instances: SybilInstance[],
  seriesNumber?: number,
  task = "total",
): Promise<string> {
  const res = await fetch(`${ML_SERVICE_URL}/analyze/segment/async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      study_id: studyId,
      instances,
      series_number: seriesNumber,
      task,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `ML service error: ${res.status}`);
  }

  const data = await res.json();
  return data.job_id as string;
}

export async function getSegmentJobStatus(jobId: string): Promise<{
  status: string;
  result: SegmentResult | null;
  error: string | null;
}> {
  const res = await fetch(`${ML_SERVICE_URL}/analyze/segment/jobs/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `ML service error: ${res.status}`);
  }
  const data = await res.json();
  return {
    status: data.status,
    result: data.result ?? null,
    error: data.error ?? null,
  };
}

/** @deprecated Use startSybilJob + getSybilJobStatus polling instead. */
export async function runSybil(
  studyId: string,
  instances: SybilInstance[],
  seriesNumber?: number,
): Promise<SybilResult> {
  const res = await fetch(`${ML_SERVICE_URL}/analyze/sybil`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      study_id: studyId,
      instances,
      series_number: seriesNumber,
    }),
    // No timeout — Sybil can take 5–12 min on CPU. The signal would cancel prematurely.
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `ML service error: ${res.status}`);
  }

  return res.json();
}
