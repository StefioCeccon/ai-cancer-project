export interface ImagingInstanceRef {
  id: string;
  filePath: string;
  instanceNumber: number;
  flaggedForAI: boolean;
}

export interface ImagingSeriesGroup {
  seriesNumber: number;
  label: string;
  instanceCount: number;
  filePaths: string[];
  instances: ImagingInstanceRef[];
}

export interface SeriesOptionLabelInput {
  seriesNumber: number;
  description?: string | null;
  sliceCount: number;
  sliceThicknessMm?: number | null;
  sybilSuitable?: boolean;
  includeSybilNote?: boolean;
}

/** Shared label format for viewer and ML series dropdowns. */
export function formatSeriesOptionLabel(input: SeriesOptionLabelInput): string {
  const parts = [`Series ${input.seriesNumber}`];
  if (input.description?.trim()) parts.push(input.description.trim());
  parts.push(`${input.sliceCount} slices`);
  if (input.sliceThicknessMm != null) parts.push(`${input.sliceThicknessMm} mm`);
  if (input.includeSybilNote && input.sybilSuitable === false) {
    parts.push("(not suitable for Sybil)");
  }
  return parts.join(" · ");
}

interface DbSeries {
  id: string;
  seriesNumber: number;
  description: string | null;
}

interface DbInstance {
  id: string;
  seriesId: string;
  instanceNumber: number;
  filePath: string;
  flaggedForAI: boolean;
}

function toInstanceRefs(instances: DbInstance[]): ImagingInstanceRef[] {
  return instances.map((i) => ({
    id: i.id,
    filePath: i.filePath,
    instanceNumber: i.instanceNumber,
    flaggedForAI: i.flaggedForAI,
  }));
}

/** Legacy uploads encoded DICOM series number into instanceNumber. */
export function deriveLegacySeriesNumber(instanceNumber: number): number {
  return instanceNumber >= 100_000 ? Math.floor(instanceNumber / 100_000) : 0;
}

function seriesLabel(seriesNumber: number, description?: string | null, instanceCount?: number): string {
  const parts = [`Series ${seriesNumber}`];
  if (description?.trim()) parts.push(description.trim());
  if (instanceCount != null) parts.push(`${instanceCount} slices`);
  return parts.join(" · ");
}

export function buildSeriesGroups(dbSeries: DbSeries[], instances: DbInstance[]): ImagingSeriesGroup[] {
  if (instances.length === 0) return [];

  const usesDistinctDbSeries = dbSeries.length > 1
    || new Set(dbSeries.map((s) => s.seriesNumber)).size > 1;

  if (usesDistinctDbSeries) {
    const seriesById = new Map(dbSeries.map((s) => [s.id, s]));
    const grouped = new Map<number, { description: string | null; instances: DbInstance[] }>();

    for (const inst of instances) {
      const meta = seriesById.get(inst.seriesId);
      const seriesNumber = meta?.seriesNumber ?? 0;
      const bucket = grouped.get(seriesNumber) ?? { description: meta?.description ?? null, instances: [] };
      bucket.instances.push(inst);
      grouped.set(seriesNumber, bucket);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([seriesNumber, { description, instances: seriesInstances }]) => {
        const sorted = [...seriesInstances].sort((a, b) => a.instanceNumber - b.instanceNumber);
        return {
          seriesNumber,
          label: seriesLabel(seriesNumber, description, sorted.length),
          instanceCount: sorted.length,
          filePaths: sorted.map((i) => i.filePath),
          instances: toInstanceRefs(sorted),
        };
      });
  }

  // Legacy fallback: one DB series row holding slices from many DICOM series.
  const grouped = new Map<number, DbInstance[]>();
  for (const inst of instances) {
    const seriesNumber = deriveLegacySeriesNumber(inst.instanceNumber);
    const bucket = grouped.get(seriesNumber) ?? [];
    bucket.push(inst);
    grouped.set(seriesNumber, bucket);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([seriesNumber, seriesInstances]) => {
      const sorted = [...seriesInstances].sort((a, b) => a.instanceNumber - b.instanceNumber);
      return {
        seriesNumber,
        label: seriesLabel(seriesNumber, null, sorted.length),
        instanceCount: sorted.length,
        filePaths: sorted.map((i) => i.filePath),
        instances: toInstanceRefs(sorted),
      };
    });
}
