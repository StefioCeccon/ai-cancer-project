import { eq, or, sql } from "drizzle-orm";
import {
  db,
  imagingStudies,
  imagingSeries,
  imagingInstances,
  medicalReports,
  bloodTests,
  symptoms,
  therapies,
} from "@/lib/db";
import { canAccessPatient } from "@/lib/auth/access";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUploadPath(webPath: string): string {
  const raw = webPath.startsWith("/") ? webPath : `/${webPath}`;
  // Prevent path traversal
  if (raw.includes("..") || raw.includes("\\")) return "";
  return raw.replace(/\/+/g, "/");
}

/**
 * True when `userId` may read this `/uploads/...` object (patient membership).
 * Covers DICOM by study folder, instance rows, and document filePath fields.
 */
export async function userCanReadUploadPath(
  userId: string,
  webPath: string
): Promise<boolean> {
  const path = normalizeUploadPath(webPath);
  if (!path.startsWith("/uploads/")) return false;

  const patientIds = new Set<string>();

  // Fast path: /uploads/dicom/<studyId>/... or /uploads/sybil-heatmaps/<studyId>/...
  const parts = path.split("/");
  // ["", "uploads", "dicom"|"sybil-heatmaps", "<studyId>", ...]
  if (
    (parts[2] === "dicom" || parts[2] === "sybil-heatmaps") &&
    parts[3] &&
    UUID_RE.test(parts[3])
  ) {
    const [study] = await db
      .select({ patientId: imagingStudies.patientId })
      .from(imagingStudies)
      .where(eq(imagingStudies.id, parts[3]))
      .limit(1);
    if (study) patientIds.add(study.patientId);
  }

  // Instance row with this exact path (covers demo shared object keys across tenants)
  const instanceRows = await db
    .select({ patientId: imagingStudies.patientId })
    .from(imagingInstances)
    .innerJoin(imagingSeries, eq(imagingSeries.id, imagingInstances.seriesId))
    .innerJoin(imagingStudies, eq(imagingStudies.id, imagingSeries.studyId))
    .where(eq(imagingInstances.filePath, path))
    .limit(5);
  for (const row of instanceRows) patientIds.add(row.patientId);

  // Study-level dicomPath / thumbnailPath
  const studyPathRows = await db
    .select({ patientId: imagingStudies.patientId })
    .from(imagingStudies)
    .where(
      or(eq(imagingStudies.dicomPath, path), eq(imagingStudies.thumbnailPath, path))
    )
    .limit(5);
  for (const row of studyPathRows) patientIds.add(row.patientId);

  // Documents: exact match or JSON/multi-path string containing this path
  const like = `%${path}%`;
  const [reportRows, bloodRows, symptomRows, therapyRows] = await Promise.all([
    db
      .select({ patientId: medicalReports.patientId })
      .from(medicalReports)
      .where(
        or(eq(medicalReports.filePath, path), sql`${medicalReports.filePath} like ${like}`)
      )
      .limit(5),
    db
      .select({ patientId: bloodTests.patientId })
      .from(bloodTests)
      .where(or(eq(bloodTests.filePath, path), sql`${bloodTests.filePath} like ${like}`))
      .limit(5),
    db
      .select({ patientId: symptoms.patientId })
      .from(symptoms)
      .where(or(eq(symptoms.filePath, path), sql`${symptoms.filePath} like ${like}`))
      .limit(5),
    db
      .select({ patientId: therapies.patientId })
      .from(therapies)
      .where(or(eq(therapies.filePath, path), sql`${therapies.filePath} like ${like}`))
      .limit(5),
  ]);

  for (const row of [...reportRows, ...bloodRows, ...symptomRows, ...therapyRows]) {
    patientIds.add(row.patientId);
  }

  // Heatmaps / ML overlays under a study folder without a study row → deny
  if (
    patientIds.size === 0 &&
    (parts[2] === "dicom" || parts[2] === "sybil-heatmaps") &&
    parts[3] &&
    UUID_RE.test(parts[3])
  ) {
    return false;
  }

  for (const patientId of patientIds) {
    if (await canAccessPatient(patientId, userId, "viewer")) return true;
  }

  return false;
}

/** Sanitize upload "type" folder segment. */
export function sanitizeUploadType(type: string): string {
  const cleaned = type.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return cleaned || "misc";
}
