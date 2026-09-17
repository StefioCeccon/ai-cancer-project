import { readdir, stat } from "fs/promises";
import { join } from "path";
import { db, medicalReports } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { countDocumentPages } from "./countDocumentPages";
import { parseStoredFilePaths } from "./parseStoredFilePaths";
import { getAccessiblePatientIds, inArray } from "@/lib/auth/access";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

interface UploadFileEntry {
  path: string;
  mtime: number;
}

async function listReportUploadFiles(): Promise<UploadFileEntry[]> {
  const dir = join(UPLOAD_DIR, "report");
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const files = await Promise.all(
    names.map(async (name) => {
      const fullPath = join(dir, name);
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) return null;
      return {
        path: `/uploads/report/${name}`,
        mtime: fileStat.mtimeMs,
      };
    })
  );

  return files
    .filter((file): file is UploadFileEntry => file !== null)
    .sort((a, b) => a.mtime - b.mtime || a.path.localeCompare(b.path));
}

export async function repairReportFilePaths(userId: string, patientId?: string) {
  let allReports;
  if (patientId) {
    allReports = await db
      .select()
      .from(medicalReports)
      .where(eq(medicalReports.patientId, patientId))
      .orderBy(asc(medicalReports.createdAt));
  } else {
    const ids = await getAccessiblePatientIds(userId);
    if (!ids.length) {
      return {
        repairedCount: 0,
        skippedCount: 0,
        remainingOrphanFiles: 0,
        repaired: [],
        skipped: [],
      };
    }
    allReports = await db
      .select()
      .from(medicalReports)
      .where(inArray(medicalReports.patientId, ids))
      .orderBy(asc(medicalReports.createdAt));
  }

  const linked = new Set<string>();
  for (const report of allReports) {
    for (const path of parseStoredFilePaths(report.filePath)) {
      linked.add(path);
    }
  }

  const availableFiles = (await listReportUploadFiles()).filter((file) => !linked.has(file.path));
  const needsRepair = allReports.filter((report: (typeof allReports)[number]) => parseStoredFilePaths(report.filePath).length === 0);

  let fileIndex = 0;
  const repaired: { id: string; title: string; filePath: string }[] = [];
  const skipped: { id: string; title: string; reason: string }[] = [];

  for (const report of needsRepair) {
    const pageCount = countDocumentPages(report.rawText);
    if (pageCount === 0) {
      skipped.push({ id: report.id, title: report.title, reason: "No parsed text to infer page count" });
      continue;
    }

    if (fileIndex + pageCount > availableFiles.length) {
      skipped.push({
        id: report.id,
        title: report.title,
        reason: `Not enough orphan files (needs ${pageCount}, ${availableFiles.length - fileIndex} left)`,
      });
      continue;
    }

    const paths = availableFiles.slice(fileIndex, fileIndex + pageCount).map((file) => file.path);
    fileIndex += pageCount;

    const filePath = paths.length === 1 ? paths[0] : JSON.stringify(paths);
    await db.update(medicalReports).set({ filePath }).where(eq(medicalReports.id, report.id));

    repaired.push({ id: report.id, title: report.title, filePath });
  }

  return {
    repairedCount: repaired.length,
    skippedCount: skipped.length,
    remainingOrphanFiles: availableFiles.length - fileIndex,
    repaired,
    skipped,
  };
}
