import dicomParser from "dicom-parser";
import sharp from "sharp";

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function applyWindowLevel(
  huValues: Float32Array,
  windowCenter: number,
  windowWidth: number,
  invert: boolean,
): Uint8Array {
  const lower = windowCenter - windowWidth / 2;
  const upper = windowCenter + windowWidth / 2;
  const range = Math.max(upper - lower, 1);
  const out = new Uint8Array(huValues.length);

  for (let i = 0; i < huValues.length; i += 1) {
    const clamped = Math.min(Math.max(huValues[i], lower), upper);
    const normalized = ((clamped - lower) / range) * 255;
    out[i] = invert ? 255 - normalized : normalized;
  }

  return out;
}

/** Convert raw DICOM bytes to an 8-bit grayscale PNG buffer for LLM vision. */
export async function dicomBufferToPng(buf: Buffer): Promise<Buffer> {
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const dataset = dicomParser.parseDicom(bytes);

  const rows = dataset.uint16("x00280010");
  const cols = dataset.uint16("x00280011");
  const bitsAllocated = dataset.uint16("x00280100") ?? 16;
  const pixelRepresentation = dataset.uint16("x00280103") ?? 0;
  const photometric = dataset.string("x00280004") ?? "MONOCHROME2";
  const rescaleSlope = parseNumber(dataset.string("x00281053"), 1);
  const rescaleIntercept = parseNumber(dataset.string("x00281052"), 0);
  const windowCenter = parseNumber(dataset.string("x00281050"), 40);
  const windowWidth = parseNumber(dataset.string("x00281051"), 400);

  if (!rows || !cols) {
    throw new Error("DICOM missing Rows/Columns");
  }

  const pixelElement = dataset.elements.x7fe00010;
  if (!pixelElement || pixelElement.encapsulatedPixelData) {
    throw new Error("Unsupported DICOM pixel data (compressed or missing)");
  }

  const pixelData = dataset.byteArray.subarray(
    pixelElement.dataOffset,
    pixelElement.dataOffset + pixelElement.length,
  );

  const huValues = new Float32Array(rows * cols);
  const expectedLen = rows * cols * (bitsAllocated / 8);

  if (pixelData.length < expectedLen) {
    throw new Error(`Unexpected pixel data length (${pixelData.length} < ${expectedLen})`);
  }

  const view = bitsAllocated === 16
    ? new DataView(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength)
    : null;

  for (let i = 0; i < rows * cols; i += 1) {
    let raw: number;
    if (bitsAllocated === 16 && view) {
      raw = pixelRepresentation === 1
        ? view.getInt16(i * 2, true)
        : view.getUint16(i * 2, true);
    } else {
      raw = pixelData[i];
    }
    huValues[i] = raw * rescaleSlope + rescaleIntercept;
  }

  const invert = photometric === "MONOCHROME1";
  const grayscale = applyWindowLevel(huValues, windowCenter, windowWidth, invert);

  return sharp(grayscale, {
    raw: { width: cols, height: rows, channels: 1 },
  })
    .png()
    .toBuffer();
}
