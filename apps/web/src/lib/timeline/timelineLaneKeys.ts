/** Shared timeline lane for X-ray imaging and radiology/radiography reports. */
export const RADIOGRAPHY_LANE_KEY = "group_radiography";
export const RADIOGRAPHY_LANE_LABEL = "Radiography";

/** Shared timeline lane for CT/MRI/PET imaging and tomography reports. */
export const TOMOGRAPHIES_LANE_KEY = "group_tomographies";
export const TOMOGRAPHIES_LANE_LABEL = "Tomographies";

/** Orthopedics and physiotherapy share one timeline row. */
export const ORTHOPEDICS_LANE_LABEL = "Orthopedics";

export function normalizeReportTimelineCategory(category: string): string {
  const trimmed = category.trim();
  if (/^radiology$/i.test(trimmed)) return RADIOGRAPHY_LANE_LABEL;
  if (/^tomograph(y|ies)$/i.test(trimmed)) return TOMOGRAPHIES_LANE_LABEL;
  if (/^orthopa?edics?$/i.test(trimmed)) return ORTHOPEDICS_LANE_LABEL;
  if (/^(physioth|phisioth|physical\s+therap|fisioterap)/i.test(trimmed)) {
    return ORTHOPEDICS_LANE_LABEL;
  }
  return trimmed;
}

export function isRadiographyTimelineCategory(category: string): boolean {
  return normalizeReportTimelineCategory(category).toLowerCase() === RADIOGRAPHY_LANE_LABEL.toLowerCase();
}

export function isTomographiesTimelineCategory(category: string): boolean {
  return normalizeReportTimelineCategory(category).toLowerCase() === TOMOGRAPHIES_LANE_LABEL.toLowerCase();
}
