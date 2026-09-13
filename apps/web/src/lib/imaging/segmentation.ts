import { TOTAL_SEGMENTATOR_LABELS } from "@/lib/imaging/totalSegmentatorLabels";

export interface SegmentationResult {
  model: string;
  task: string;
  series_number?: number;
  slice_count: number;
  processing_time_seconds: number;
  labels: Record<string, string>;
  mask_by_file: Record<string, string>;
  labels_on_slice: Record<string, number[]>;
  runAt?: string;
}

export interface SegmentationViewerOverlay {
  seriesNumber: number;
  labels: Record<string, string>;
  maskByFileName: Record<string, string>;
  labelsOnSlice: Record<string, number[]>;
}

interface MaskCacheEntry {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface ViewportLike {
  canvasToWorld: (pos: [number, number]) => [number, number, number];
  worldToCanvas: (pos: [number, number, number]) => [number, number];
  getImageData: () => {
    dimensions?: [number, number, number];
    imageData: {
      worldToIndex?: (pos: [number, number, number]) => [number, number, number];
      indexToWorld?: (pos: [number, number, number]) => [number, number, number];
      getDimensions?: () => [number, number, number];
    };
  } | undefined;
}

export interface ImageBounds {
  topLeft: [number, number];
  topRight: [number, number];
  bottomLeft: [number, number];
  bottomRight: [number, number];
}

const maskCache = new Map<string, MaskCacheEntry>();

export function clearMaskCache() {
  maskCache.clear();
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function segmentationToViewerOverlay(result: SegmentationResult): SegmentationViewerOverlay | null {
  if (result.series_number == null) return null;
  const storedLabels = result.labels ?? {};
  const labels = Object.keys(storedLabels).length > 0 ? storedLabels : TOTAL_SEGMENTATOR_LABELS;
  return {
    seriesNumber: Number(result.series_number),
    labels,
    maskByFileName: result.mask_by_file ?? {},
    labelsOnSlice: result.labels_on_slice ?? {},
  };
}

export function formatStructureLabel(raw: string): string {
  if (!raw || raw.startsWith("Background")) return raw;
  return raw
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveRawLabel(labels: Record<string, string>, labelId: number): string {
  if (labelId <= 0) return "Background / no structure";
  return labels[String(labelId)] ?? TOTAL_SEGMENTATOR_LABELS[String(labelId)] ?? "";
}

export function resolveMaskUrl(overlay: SegmentationViewerOverlay, filePath: string): string | null {
  return overlay.maskByFileName[basename(filePath)] ?? null;
}

export function labelsForSlice(overlay: SegmentationViewerOverlay, filePath: string): string[] {
  const ids = overlay.labelsOnSlice[basename(filePath)] ?? [];
  return ids
    .map((id) => labelName(overlay.labels, id))
    .filter((name) => name && !name.startsWith("Background"));
}

export function sliceHasLabel(
  overlay: SegmentationViewerOverlay,
  filePath: string,
  labelId: number,
): boolean {
  if (labelId <= 0) return false;
  const ids = overlay.labelsOnSlice[basename(filePath)] ?? [];
  return ids.includes(labelId);
}

export function labelName(labels: Record<string, string>, labelId: number): string {
  const raw = resolveRawLabel(labels, labelId);
  if (!raw) return `Unknown structure (${labelId})`;
  return formatStructureLabel(raw);
}

export async function loadMaskEntry(maskUrl: string): Promise<MaskCacheEntry> {
  const cached = maskCache.get(maskUrl);
  if (cached) return cached;

  const res = await fetch(maskUrl);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read segmentation mask");
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const entry = { width: canvas.width, height: canvas.height, data: imageData.data };
  maskCache.set(maskUrl, entry);
  return entry;
}

export function sampleMaskLabelFromEntry(entry: MaskCacheEntry, col: number, row: number): number {
  if (col < 0 || row < 0 || col >= entry.width || row >= entry.height) return 0;
  const idx = (row * entry.width + col) * 4;
  return entry.data[idx] ?? 0;
}

/** Map a viewer click to DICOM image column/row using Cornerstone transforms. */
export function mapViewportClickToImageCoords(
  viewport: ViewportLike,
  element: HTMLElement,
  clientX: number,
  clientY: number,
): { col: number; row: number } | null {
  const rect = element.getBoundingClientRect();
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;
  const imageData = viewport.getImageData();
  if (!imageData?.imageData?.worldToIndex) return null;

  const world = viewport.canvasToWorld([canvasX, canvasY]);
  const ijk = imageData.imageData.worldToIndex(world);
  const col = Math.round(ijk[0]);
  const row = Math.round(ijk[1]);
  const dims = imageData.dimensions ?? imageData.imageData.getDimensions?.();
  if (!dims) return { col, row };
  if (col < 0 || row < 0 || col >= dims[0] || row >= dims[1]) return null;
  return { col, row };
}

export function getImageBoundsInCanvas(viewport: ViewportLike): ImageBounds | null {
  const imageData = viewport.getImageData();
  const indexToWorld = imageData?.imageData?.indexToWorld;
  const dims = imageData?.dimensions ?? imageData?.imageData?.getDimensions?.();
  if (!indexToWorld || !dims) return null;

  const cols = dims[0];
  const rows = dims[1];
  const topLeft = viewport.worldToCanvas(indexToWorld([0, 0, 0]));
  const topRight = viewport.worldToCanvas(indexToWorld([cols - 1, 0, 0]));
  const bottomLeft = viewport.worldToCanvas(indexToWorld([0, rows - 1, 0]));
  const bottomRight = viewport.worldToCanvas(indexToWorld([cols - 1, rows - 1, 0]));
  return { topLeft, topRight, bottomLeft, bottomRight };
}

/** Draw filled + outlined region for one label using Cornerstone per-pixel mapping. */
export function drawLabelHighlight(
  canvas: HTMLCanvasElement,
  viewport: ViewportLike,
  entry: MaskCacheEntry,
  labelId: number,
) {
  const imageData = viewport.getImageData();
  const indexToWorld = imageData?.imageData?.indexToWorld;
  if (!indexToWorld) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (labelId <= 0) return;

  const { width: mw, height: mh, data } = entry;
  const isLabel = (col: number, row: number) => {
    if (col < 0 || row < 0 || col >= mw || row >= mh) return false;
    return data[(row * mw + col) * 4] === labelId;
  };

  for (let row = 0; row < mh; row += 1) {
    for (let col = 0; col < mw; col += 1) {
      if (!isLabel(col, row)) continue;

      const edge = !isLabel(col - 1, row) || !isLabel(col + 1, row)
        || !isLabel(col, row - 1) || !isLabel(col, row + 1);
      const world = indexToWorld([col, row, 0]);
      const [cx, cy] = viewport.worldToCanvas(world);

      ctx.fillStyle = edge ? "rgba(45, 212, 191, 0.95)" : "rgba(45, 212, 191, 0.38)";
      ctx.fillRect(cx - 1, cy - 1, edge ? 3 : 2, edge ? 3 : 2);
    }
  }
}

export async function sampleMaskLabel(maskUrl: string, col: number, row: number): Promise<number> {
  const entry = await loadMaskEntry(maskUrl);
  return sampleMaskLabelFromEntry(entry, col, row);
}

/** @deprecated Use mapViewportClickToImageCoords with Cornerstone viewport. */
export function mapClickToMaskCoords(
  clickX: number,
  clickY: number,
  containerWidth: number,
  containerHeight: number,
  maskWidth: number,
  maskHeight: number,
): { x: number; y: number } | null {
  if (containerWidth <= 0 || containerHeight <= 0) return null;

  const scale = Math.min(containerWidth / maskWidth, containerHeight / maskHeight);
  const renderedW = maskWidth * scale;
  const renderedH = maskHeight * scale;
  const offsetX = (containerWidth - renderedW) / 2;
  const offsetY = (containerHeight - renderedH) / 2;

  const localX = clickX - offsetX;
  const localY = clickY - offsetY;
  if (localX < 0 || localY < 0 || localX > renderedW || localY > renderedH) return null;

  return {
    x: Math.min(maskWidth - 1, Math.max(0, Math.floor((localX / renderedW) * maskWidth))),
    y: Math.min(maskHeight - 1, Math.max(0, Math.floor((localY / renderedH) * maskHeight))),
  };
}
