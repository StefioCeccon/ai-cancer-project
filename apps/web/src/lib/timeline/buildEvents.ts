import type { BloodMarker, ReportType, TherapyType } from "@cancer-monitor/shared";
import type { TimelineEvent, TimelineLane, TimelineResponse } from "./types";
import { isTimelineCategoryManual } from "./timelineCategoryOptions";
import {
  getTypeColor,
  truncate,
} from "./colors";
import { getImagingModalityLabel, getImagingTimelineLane } from "./imagingLanes";
import { getReportTimelineLane } from "./reportLanes";

type BloodTestRow = {
  id: string;
  testDate: string;
  labName?: string | null;
  requestingPhysician?: string | null;
  aiInterpretation?: string | null;
};

// DB rows use `null` for absent values; shared BloodMarker uses `undefined`.
// Accept both so the timeline route can pass raw Drizzle rows directly.
type MarkerRow = Omit<BloodMarker, "referenceMin" | "referenceMax" | "notes"> & {
  id: string;
  bloodTestId: string;
  referenceMin?: number | null;
  referenceMax?: number | null;
  notes?: string | null;
};

type ImagingRow = {
  id: string;
  modality: string;
  studyDate: string;
  bodyPart: string;
  description?: string | null;
  radiologistReport?: string | null;
  aiFindings?: string | null;
};

type ReportRow = {
  id: string;
  reportType: ReportType;
  reportDate: string;
  title: string;
  author?: string | null;
  institution?: string | null;
  aiSummary?: string | null;
  rawText?: string | null;
  clinicalSpecialty?: string | null;
  extractedData?: unknown;
};

type SymptomRow = {
  id: string;
  name: string;
  severity?: string | null;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
};

type TherapyRow = {
  id: string;
  name: string;
  therapyType: TherapyType;
  startDate: string;
  endDate?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  notes?: string | null;
  medicationCount?: number;
  medicationNames?: string[];
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "unknown";
}

function summarizeSymptom(symptom: SymptomRow): string {
  const parts: string[] = [];
  if (symptom.severity) parts.push(symptom.severity);
  if (symptom.endDate) parts.push(`until ${symptom.endDate}`);
  else parts.push("ongoing or point event");
  if (symptom.notes?.trim()) parts.push(truncate(symptom.notes, 80));
  return parts.join(" · ") || symptom.name;
}

function summarizeTherapy(therapy: TherapyRow): string {
  const parts: string[] = [];
  if (therapy.dosage) parts.push(therapy.dosage);
  if (therapy.frequency) parts.push(therapy.frequency);
  if (therapy.medicationCount && therapy.medicationCount > 0) {
    parts.push(`${therapy.medicationCount} medication${therapy.medicationCount === 1 ? "" : "s"}`);
  }
  if (therapy.notes?.trim()) parts.push(truncate(therapy.notes, 60));
  return truncate(parts.join(" · ") || therapy.name, 140);
}

function summarizeBloodTest(test: BloodTestRow, markers: MarkerRow[]): string {
  if (test.aiInterpretation?.trim()) {
    return truncate(test.aiInterpretation, 140);
  }
  const abnormal = markers.filter((m) => m.status !== "normal");
  if (abnormal.length > 0) {
    const parts = abnormal.slice(0, 4).map((m) => {
      const flag = m.status.replace("_", " ");
      return `${m.name} ${m.value} ${m.unit} (${flag})`;
    });
    const extra = abnormal.length > 4 ? `, +${abnormal.length - 4} more` : "";
    return truncate(parts.join(", ") + extra, 140);
  }
  if (markers.length > 0) {
    return `${markers.length} marker${markers.length === 1 ? "" : "s"}, all within reference range`;
  }
  if (test.labName) return `Lab: ${test.labName}`;
  return "Blood test results";
}

function summarizeImaging(study: ImagingRow): string {
  if (study.aiFindings?.trim()) return truncate(study.aiFindings, 140);
  if (study.radiologistReport?.trim()) return truncate(study.radiologistReport, 140);
  if (study.description?.trim()) return truncate(study.description, 140);
  return study.bodyPart || "Imaging study";
}

function summarizeReport(report: ReportRow): string {
  if (report.aiSummary?.trim()) return truncate(report.aiSummary, 140);
  if (report.rawText?.trim()) return truncate(report.rawText, 140);
  const parts = [report.author, report.institution].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return report.title;
}

function bloodTestTitle(test: BloodTestRow, markers: MarkerRow[]): string {
  const datePart = test.testDate;
  if (test.labName) return `Blood test · ${test.labName}`;
  if (markers.length > 0) return `Blood test (${markers.length} markers)`;
  return `Blood test · ${datePart}`;
}

export function buildTimelineResponse(
  bloodTests: BloodTestRow[],
  markersByTestId: Map<string, MarkerRow[]>,
  imaging: ImagingRow[],
  reports: ReportRow[],
  symptomRows: SymptomRow[],
  therapyRows: TherapyRow[],
  locale: string
): TimelineResponse {
  const events: TimelineEvent[] = [];

  for (const test of bloodTests) {
    const markers = markersByTestId.get(test.id) ?? [];
    const abnormalCount = markers.filter((m) => m.status !== "normal").length;
    events.push({
      id: test.id,
      category: "blood_test",
      typeKey: "blood_test",
      typeLabel: "Blood Test",
      date: test.testDate,
      title: bloodTestTitle(test, markers),
      summary: summarizeBloodTest(test, markers),
      detailHref: `/${locale}/blood-tests`,
      meta: {
        labName: test.labName,
        markerCount: markers.length,
        abnormalCount,
      },
    });
  }

  for (const study of imaging) {
    const lane = getImagingTimelineLane(study.modality);
    const modalityLabel = getImagingModalityLabel(study.modality);
    events.push({
      id: study.id,
      category: "imaging",
      typeKey: lane.typeKey,
      typeLabel: lane.typeLabel,
      date: study.studyDate,
      title: `${modalityLabel} · ${study.bodyPart}`,
      summary: summarizeImaging(study),
      detailHref: `/${locale}/imaging/${study.id}`,
      meta: {
        modality: study.modality,
        bodyPart: study.bodyPart,
        imagingGroup: lane.group,
      },
    });
  }

  for (const report of reports) {
    const lane = getReportTimelineLane(report);
    events.push({
      id: report.id,
      category: "report",
      typeKey: lane.typeKey,
      typeLabel: lane.typeLabel,
      date: report.reportDate,
      title: report.title,
      summary: summarizeReport(report),
      detailHref: `/${locale}/reports`,
      meta: {
        reportType: report.reportType,
        author: report.author,
        institution: report.institution,
        category: report.clinicalSpecialty ?? undefined,
        timelineCategoryManual: isTimelineCategoryManual(report.extractedData),
      },
    });
  }

  for (const symptom of symptomRows) {
    const typeKey = `symptom_${slugify(symptom.name)}`;
    events.push({
      id: symptom.id,
      category: "symptom",
      typeKey,
      typeLabel: symptom.name,
      date: symptom.startDate,
      endDate: symptom.endDate,
      title: symptom.name,
      summary: summarizeSymptom(symptom),
      detailHref: `/${locale}/symptoms`,
      meta: {
        severity: symptom.severity,
      },
    });
  }

  for (const therapy of therapyRows) {
    const typeKey = `therapy_${slugify(therapy.name)}`;
    events.push({
      id: therapy.id,
      category: "therapy",
      typeKey,
      typeLabel: therapy.name,
      date: therapy.startDate,
      endDate: therapy.endDate,
      title: therapy.name,
      summary: summarizeTherapy(therapy),
      detailHref: `/${locale}/therapies`,
      meta: {
        therapyType: therapy.therapyType,
        dosage: therapy.dosage,
        frequency: therapy.frequency,
        medicationCount: therapy.medicationCount,
        medicationNames: therapy.medicationNames,
      },
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  const laneKeys = new Map<string, TimelineLane>();
  for (const e of events) {
    if (!laneKeys.has(e.typeKey)) {
      laneKeys.set(e.typeKey, {
        typeKey: e.typeKey,
        typeLabel: e.typeLabel,
        category: e.category,
        color: getTypeColor(e.typeKey, e.category),
      });
    }
  }

  const categoryOrder: Record<string, number> = {
    blood_test: 0,
    symptom: 1,
    therapy: 2,
    imaging: 3,
    report: 4,
  };

  const lanes = [...laneKeys.values()].sort((a, b) => {
    const co = categoryOrder[a.category] - categoryOrder[b.category];
    if (co !== 0) return co;
    return a.typeLabel.localeCompare(b.typeLabel);
  });

  return { events, lanes };
}
