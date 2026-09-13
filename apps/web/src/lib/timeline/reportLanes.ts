import { getReportTypeLabel, reportTypeKey } from "./colors";
import {
  isRadiographyTimelineCategory,
  isTomographiesTimelineCategory,
  normalizeReportTimelineCategory,
  RADIOGRAPHY_LANE_KEY,
  RADIOGRAPHY_LANE_LABEL,
  TOMOGRAPHIES_LANE_KEY,
  TOMOGRAPHIES_LANE_LABEL,
} from "./timelineLaneKeys";

export function categorySlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function reportCategoryLaneKey(category: string): string {
  if (isRadiographyTimelineCategory(category)) return RADIOGRAPHY_LANE_KEY;
  if (isTomographiesTimelineCategory(category)) return TOMOGRAPHIES_LANE_KEY;
  return `report_category_${categorySlug(normalizeReportTimelineCategory(category))}`;
}

/** Group reports on the timeline by category derived from the parsed title. */
export function getReportTimelineLane(report: {
  reportType: string;
  title: string;
  clinicalSpecialty?: string | null;
}): { typeKey: string; typeLabel: string } {
  const category = report.clinicalSpecialty?.trim();
  if (category) {
    const normalized = normalizeReportTimelineCategory(category);
    if (isRadiographyTimelineCategory(normalized)) {
      return { typeKey: RADIOGRAPHY_LANE_KEY, typeLabel: RADIOGRAPHY_LANE_LABEL };
    }
    if (isTomographiesTimelineCategory(normalized)) {
      return { typeKey: TOMOGRAPHIES_LANE_KEY, typeLabel: TOMOGRAPHIES_LANE_LABEL };
    }
    return {
      typeKey: reportCategoryLaneKey(normalized),
      typeLabel: normalized,
    };
  }

  if (report.reportType === "radiology") {
    return { typeKey: RADIOGRAPHY_LANE_KEY, typeLabel: RADIOGRAPHY_LANE_LABEL };
  }

  return {
    typeKey: reportTypeKey(report.reportType),
    typeLabel: getReportTypeLabel(report.reportType),
  };
}

/** Stored DB value for timeline category (Radiology → Radiography). */
export function normalizeStoredTimelineCategory(category: string | null): string | null {
  if (category === null) return null;
  const trimmed = category.trim();
  if (!trimmed) return "";
  return normalizeReportTimelineCategory(trimmed);
}
