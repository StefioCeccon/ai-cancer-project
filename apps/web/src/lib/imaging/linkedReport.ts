/** Build radiology report text for imaging AI prompts (inline field + linked medical reports). */

export interface LinkedReportForPrompt {
  title: string;
  reportType: string;
  reportDate: string;
  author?: string | null;
  rawText?: string | null;
  aiSummary?: string | null;
}

function reportBody(report: LinkedReportForPrompt): string | null {
  const raw = report.rawText?.trim();
  if (raw) return raw;
  const summary = report.aiSummary?.trim();
  if (summary) return summary;
  return null;
}

export function linkedReportHasContent(report: LinkedReportForPrompt): boolean {
  return reportBody(report) != null;
}

/** Combined report text for Gemini vision prompts, or null if none available. */
export function buildImagingReportContext(
  studyReport: string | null | undefined,
  linkedReports: LinkedReportForPrompt[],
): string | null {
  const sections: string[] = [];

  const inline = studyReport?.trim();
  if (inline) {
    sections.push(inline);
  }

  for (const report of linkedReports) {
    const body = reportBody(report);
    if (!body) continue;

    const meta = [
      report.title,
      report.reportDate,
      report.author ?? undefined,
      report.reportType.replace(/_/g, " "),
    ]
      .filter(Boolean)
      .join(" · ");

    sections.push(`[${meta}]\n${body}`);
  }

  return sections.length > 0 ? sections.join("\n\n---\n\n") : null;
}

export function imagingStudyHasReportContext(
  studyReport: string | null | undefined,
  linkedReports: Array<LinkedReportForPrompt & { hasContent?: boolean }>,
): boolean {
  if (studyReport?.trim()) return true;
  return linkedReports.some((r) => r.hasContent ?? linkedReportHasContent(r));
}
