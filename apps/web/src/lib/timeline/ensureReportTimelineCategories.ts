import { db, medicalReports } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  classifyReportTimelineCategory,
  shouldRefreshTimelineCategory,
} from "@/lib/upload/classifyReportTimelineCategory";
import { isTimelineCategoryManual } from "@/lib/timeline/timelineCategoryOptions";
import { normalizeStoredTimelineCategory } from "@/lib/timeline/reportLanes";

type ReportForCategory = {
  id: string;
  title: string;
  reportType: string;
  clinicalSpecialty?: string | null;
  extractedData?: unknown;
};

/** Classify timeline groups from titles once and persist on the report. */
export async function ensureReportTimelineCategories<T extends ReportForCategory>(
  reports: T[]
): Promise<T[]> {
  const pending = reports.filter(
    (r) =>
      !isTimelineCategoryManual(r.extractedData) &&
      shouldRefreshTimelineCategory(r.clinicalSpecialty, {
        title: r.title,
        reportType: r.reportType,
      })
  );
  if (pending.length === 0) return reports;

  const byId = new Map(reports.map((r) => [r.id, { ...r }]));

  await Promise.all(
    pending.map(async (report) => {
      const category = await classifyReportTimelineCategory({
        title: report.title,
        reportType: report.reportType,
      });

      const normalized = normalizeStoredTimelineCategory(category);

      await db
        .update(medicalReports)
        .set({ clinicalSpecialty: normalized ?? "" })
        .where(eq(medicalReports.id, report.id));

      const updated = byId.get(report.id);
      if (updated) updated.clinicalSpecialty = normalized;
    })
  );

  return [...byId.values()];
}
