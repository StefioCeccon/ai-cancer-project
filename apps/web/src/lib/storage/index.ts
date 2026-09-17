import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * File storage abstraction with two backends:
 *
 *   - **local** (default): writes/reads under `apps/web/public/uploads`, served
 *     statically at `/uploads/...`. This is the self-host / local-dev behaviour and
 *     keeps existing local data and scans working untouched.
 *   - **r2**: Cloudflare R2 (S3-compatible). Activated automatically when the four
 *     R2 env vars are present (the live demo on Vercel). New uploads go to R2 and the
 *     browser streams files directly from R2 via short-lived signed URLs (zero egress).
 *
 * Stored paths are kept identical across both backends (always `/uploads/...`), so
 * database rows are backend-agnostic and switching backends needs no data migration.
 */

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;

export const isR2Configured = Boolean(
  accountId && accessKeyId && secretAccessKey && bucket,
);

export const storageBackend: "r2" | "local" = isR2Configured ? "r2" : "local";

const PUBLIC_DIR = join(process.cwd(), "public");

let client: S3Client | null = null;
function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    });
  }
  return client;
}

/** Strip leading slashes so "/uploads/x" becomes the R2 object key "uploads/x". */
function toObjectKey(webPath: string): string {
  return webPath.replace(/^\/+/, "");
}

/** Absolute filesystem path under public/ for a stored web path. */
function toLocalPath(webPath: string): string {
  return join(PUBLIC_DIR, toObjectKey(webPath));
}

export interface PutResult {
  /** The web path to persist in the database (e.g. "/uploads/dicom/<id>/<file>.dcm"). */
  path: string;
}

/**
 * Persist `body` at `webPath`. Returns the same web path for storage in the DB,
 * regardless of backend.
 */
export async function putObject(
  webPath: string,
  body: Buffer,
  contentType?: string,
): Promise<PutResult> {
  if (storageBackend === "r2") {
    await r2().send(
      new PutObjectCommand({
        Bucket: bucket!,
        Key: toObjectKey(webPath),
        Body: body,
        ContentType: contentType,
      }),
    );
    return { path: webPath };
  }

  const abs = toLocalPath(webPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, body);
  return { path: webPath };
}

/** Read raw bytes for a stored web path (used by server-side DICOM→PNG conversion). */
export async function getObjectBytes(webPath: string): Promise<Buffer> {
  if (storageBackend === "r2") {
    try {
      const res = await r2().send(
        new GetObjectCommand({ Bucket: bucket!, Key: toObjectKey(webPath) }),
      );
      const bytes = await res.Body!.transformToByteArray();
      return Buffer.from(bytes);
    } catch (r2Error) {
      // Dev convenience: when R2 is configured but the object isn't there (e.g. data
      // that predates R2 and only exists in public/uploads on this machine), fall back
      // to the local file. Harmless on the demo, where no local files exist.
      try {
        return await readFile(toLocalPath(webPath));
      } catch {
        throw r2Error;
      }
    }
  }

  return readFile(toLocalPath(webPath));
}

/**
 * Short-lived signed GET URL for direct browser access (R2 only). Prefer
 * `getObjectForResponse` for authenticated proxying so signatures never appear
 * in the browser Network tab.
 */
export async function getSignedReadUrl(
  webPath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  if (storageBackend !== "r2") return webPath;
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: bucket!, Key: toObjectKey(webPath) }),
    { expiresIn: expiresInSeconds },
  );
}

export type ObjectResponse = {
  body: ReadableStream<Uint8Array> | Blob | Buffer;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  acceptRanges?: string;
  status: number;
};

/**
 * Fetch object bytes from R2 (or local) for authenticated proxy responses.
 * Forwards HTTP Range when provided (needed for DICOM loaders).
 */
export async function getObjectForResponse(
  webPath: string,
  rangeHeader?: string | null,
): Promise<ObjectResponse> {
  if (storageBackend === "r2") {
    const res = await r2().send(
      new GetObjectCommand({
        Bucket: bucket!,
        Key: toObjectKey(webPath),
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      }),
    );

    const body = res.Body;
    if (!body) throw new Error("Empty object body");

    // AWS SDK v3 Body is AsyncIterable / Readable in Node — convert to Web stream when possible
    const webStream =
      typeof (body as { transformToWebStream?: () => ReadableStream }).transformToWebStream ===
      "function"
        ? (body as { transformToWebStream: () => ReadableStream<Uint8Array> }).transformToWebStream()
        : undefined;

    const buf =
      !webStream && typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray ===
      "function"
        ? Buffer.from(
            await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
          )
        : undefined;

    return {
      body: (webStream as ReadableStream<Uint8Array>) ?? buf!,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
      contentRange: res.ContentRange,
      acceptRanges: res.AcceptRanges ?? "bytes",
      status: rangeHeader && res.ContentRange ? 206 : 200,
    };
  }

  const abs = toLocalPath(webPath);
  const { size } = await import("fs/promises").then((fs) => fs.stat(abs));
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : size - 1;
      const { createReadStream } = await import("fs");
      const { Readable } = await import("stream");
      const nodeStream = createReadStream(abs, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
      return {
        body: webStream,
        contentType: undefined,
        contentLength: end - start + 1,
        contentRange: `bytes ${start}-${end}/${size}`,
        acceptRanges: "bytes",
        status: 206,
      };
    }
  }

  const data = await readFile(abs);
  return {
    body: data,
    contentLength: data.length,
    acceptRanges: "bytes",
    status: 200,
  };
}
