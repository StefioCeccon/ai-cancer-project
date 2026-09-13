/** Suggested timeline row labels for reports (user can also enter a custom value). */
export const TIMELINE_CATEGORY_OPTIONS = [
  "Angiology",
  "Tomographies",
  "Radiography",
  "Ultrasound",
  "Pathology",
  "Oncology",
  "Neurology",
  "Gastroenterology",
  "Cardiology",
  "Otorhinolaryngology",
  "Pulmonology",
  "Endocrinology",
  "Dermatology",
  "Urology",
  "Orthopedics",
  "Psychiatry",
] as const;

export type TimelineCategoryOption = (typeof TIMELINE_CATEGORY_OPTIONS)[number];

export function isTimelineCategoryManual(extractedData: unknown): boolean {
  if (!extractedData || typeof extractedData !== "object") return false;
  return !!(extractedData as { timelineCategoryManual?: boolean }).timelineCategoryManual;
}
