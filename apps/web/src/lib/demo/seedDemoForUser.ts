import { eq, and, isNull, asc, desc } from "drizzle-orm";
import type { AnalysisResult } from "@ai-cancer-project/shared";
import {
  db,
  patients,
  patientMembers,
  bloodTests,
  bloodMarkers,
  therapies,
  therapyMedications,
  symptoms,
  medicalReports,
  analysisRuns,
  imagingStudies,
  imagingSeries,
  imagingInstances,
} from "@/lib/db";
import type { ImagingStudyInsert } from "@/lib/db/schema";
import demoImagingData from "./demoImaging.json";
import { DEMO_SOURCE, ensureDemoSourceFiles } from "./demoSourceFiles";

interface DemoImaging {
  study: {
    modality: string;
    studyDate: string;
    bodyPart: string;
    description: string | null;
    seriesCount: number;
    instanceCount: number;
  };
  series: { seriesNumber: number; description: string | null; modality: string; instanceCount: number }[];
  instances: { seriesNumber: number; instanceNumber: number; filePath: string; sopInstanceUid: string | null }[];
}

// The NLST chest CT (public, de-identified). All seeded users' instances point at
// this single shared set of R2 objects — no per-visitor file duplication.
const demoImaging = demoImagingData as DemoImaging;
type Modality = ImagingStudyInsert["modality"];

type MarkerStatus = "normal" | "low" | "high" | "critical_low" | "critical_high";

function markerStatus(value: number, min: number | null, max: number | null): MarkerStatus {
  if (min !== null && value < min) return value < min * 0.5 ? "critical_low" : "low";
  if (max !== null && value > max) return value > max * 1.5 ? "critical_high" : "high";
  return "normal";
}

/** `monthsAgo` from today as a YYYY-MM-DD string. */
function isoDaysoMonths(monthsAgo: number, dayOffset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

interface MarkerSpec {
  name: string;
  unit: string;
  min: number | null;
  max: number | null;
  // One value per monthly test, oldest → newest (6 points).
  series: number[];
}

// Fictional NSCLC patient responding to first-line chemo: CEA/CA 19-9 trending
// down, mild treatment-related cytopenia recovering. All values invented.
const MARKER_SPECS: MarkerSpec[] = [
  { name: "Hemoglobin", unit: "g/dL", min: 12, max: 16, series: [10.4, 10.9, 11.3, 11.6, 12.1, 12.4] },
  { name: "White Blood Cells", unit: "10^9/L", min: 4, max: 11, series: [3.6, 3.9, 4.4, 5.1, 5.6, 6.0] },
  { name: "Platelets", unit: "10^9/L", min: 150, max: 400, series: [142, 168, 191, 214, 233, 247] },
  { name: "CEA", unit: "ng/mL", min: 0, max: 5, series: [42.0, 31.5, 22.8, 15.4, 9.7, 6.2] },
  { name: "CA 19-9", unit: "U/mL", min: 0, max: 37, series: [88, 71, 59, 47, 39, 34] },
  { name: "Creatinine", unit: "mg/dL", min: 0.6, max: 1.3, series: [0.9, 0.95, 1.0, 0.98, 0.92, 0.9] },
];

const ONCOLOGY_LETTER = `ONCOLOGY CONSULTATION — FOLLOW-UP

Diagnosis: Non-small cell lung cancer (adenocarcinoma), right upper lobe, clinical stage IIIA.

Interval history:
The patient has completed four cycles of carboplatin + pemetrexed with good tolerance.
Performance status ECOG 1. Tumor marker CEA has fallen from 42.0 to 6.2 ng/mL over the
treatment course, consistent with biochemical response. Mild treatment-related anemia and
neutropenia have improved between cycles.

Assessment:
Partial biochemical response to first-line chemotherapy. No new symptoms suggestive of
progression. Restaging CT recommended after the current cycle.

Plan:
- Proceed with cycle 5 of carboplatin + pemetrexed.
- Restaging contrast CT chest/abdomen in ~3 weeks.
- Continue antiemetics and monitor CBC before each cycle.
- Review in clinic with imaging results.

(Fictional record generated for demonstration purposes only.)`;

const PATHOLOGY_REPORT = `SURGICAL PATHOLOGY REPORT

Specimen: CT-guided core biopsy, right upper lobe lung mass.

Microscopic description:
Cores of lung parenchyma infiltrated by a malignant epithelial neoplasm forming irregular
glands. Tumor cells show moderate nuclear atypia and prominent nucleoli.

Immunohistochemistry:
- TTF-1: positive
- Napsin A: positive
- p40: negative

Diagnosis:
Adenocarcinoma, consistent with primary lung origin.

Molecular studies (sent separately):
EGFR, ALK, ROS1, and PD-L1 testing requested.

(Fictional record generated for demonstration purposes only.)`;

const RADIOLOGY_REPORT = `CT CHEST — RESTAGING (FICTIONAL DEMO)

Indication: Stage IIIA NSCLC, post cycle 4 carboplatin/pemetrexed. Assess response.

Technique: Contrast-enhanced CT chest. Comparison to prior staging CT (not available in demo).

Findings:
Right upper lobe mass appears smaller than expected for untreated disease; residual soft-tissue
opacity along the fissure without new satellite nodules. No new mediastinal lymphadenopathy
above short-axis 1 cm. No pleural effusion. Limited upper abdomen unremarkable.

Impression:
1. Probable partial radiologic response of RUL adenocarcinoma (fictional).
2. No new distant findings in the scanned FOV.

(Fictional record generated for demonstration purposes only. Linked to the shared NLST sample CT.)`;

const DEMO_ANALYSIS: AnalysisResult = {
  summary:
    "Stage IIIA lung adenocarcinoma showing a partial biochemical response to first-line " +
    "carboplatin + pemetrexed. CEA has declined from 42.0 to 6.2 ng/mL across four cycles, " +
    "and treatment-related cytopenias are recovering. No current evidence of progression; " +
    "restaging imaging is the key next step.",
  progression: {
    trend: "improving",
    description:
      "Tumor markers (CEA, CA 19-9) are trending steadily downward and blood counts are " +
      "recovering toward normal, consistent with treatment response.",
    comparedPeriod: "last 6 months",
    keyIndicators: ["CEA 42.0 → 6.2 ng/mL", "CA 19-9 88 → 34 U/mL", "Hemoglobin 10.4 → 12.4 g/dL"],
  },
  cancerSigns: [
    { finding: "Elevated CEA, now near normal after therapy", source: "bloodtest", severity: "moderate", confidence: 0.8 },
    { finding: "Biopsy-confirmed lung adenocarcinoma (TTF-1+/Napsin A+)", source: "report", severity: "severe", confidence: 0.95 },
  ],
  nextSteps: [
    { action: "Restaging contrast CT chest/abdomen", priority: "high", timeframe: "~3 weeks", rationale: "Confirm radiologic response and guide continuation vs. change of therapy." },
    { action: "CBC before next cycle", priority: "medium", timeframe: "before cycle 5", rationale: "Monitor recovering neutropenia/anemia for safe dosing." },
    { action: "Confirm molecular results (EGFR/ALK/ROS1/PD-L1)", priority: "medium", timeframe: "next visit", rationale: "May open targeted or immunotherapy options." },
  ],
  riskFactors: [
    { factor: "Treatment-related myelosuppression", level: "medium", description: "Cytopenias improving but warrant monitoring before each cycle." },
  ],
  confidenceScore: 0.78,
  disclaimer:
    "This is an AI-generated summary of fictional demonstration data and is not medical advice. " +
    "Always consult a qualified healthcare professional.",
};

/**
 * Populate a brand-new user's account with a fictional demo patient and data so
 * the product looks alive on first load. Idempotent for the patient row; if the
 * patient exists but imaging/reports are missing (partial prior seed), backfills
 * those. Intended when `NEXT_PUBLIC_DEMO_MODE` is on.
 */
export async function seedDemoForUser(userId: string): Promise<void> {
  // Shared demo PNGs on R2/local (once for all users)
  await ensureDemoSourceFiles();

  const existing = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    const patientId = existing[0].id;
    await db
      .insert(patientMembers)
      .values({ patientId, userId, role: "owner" })
      .onConflictDoNothing();

    const existingImaging = await db
      .select({ id: imagingStudies.id })
      .from(imagingStudies)
      .where(eq(imagingStudies.userId, userId))
      .limit(1);
    if (existingImaging.length === 0) {
      await seedDemoImaging(userId, patientId);
    }

    await seedDemoReportsIfMissing(userId, patientId);
    await attachDemoSourceFilesIfMissing(patientId);
    return;
  }

  const [patient] = await db
    .insert(patients)
    .values({
      userId,
      firstName: "Jordan",
      lastName: "Rivera",
      dateOfBirth: "1959-04-12",
      gender: "other",
      diagnosisDate: isoDaysoMonths(7),
      cancerType: "Non-small cell lung cancer (adenocarcinoma)",
      cancerStage: "IIIA",
      primaryPhysician: "Dr. A. Demo",
      notes: "Fictional demo patient. All data is synthetic and for demonstration only.",
    })
    .returning();

  await db.insert(patientMembers).values({
    patientId: patient.id,
    userId,
    role: "owner",
  });

  // 6 monthly blood tests (oldest → newest), each with the full marker panel.
  for (let i = 0; i < 6; i++) {
    const monthsAgo = 6 - i; // 6,5,4,3,2,1 months ago
    const [test] = await db
      .insert(bloodTests)
      .values({
        userId,
        patientId: patient.id,
        testDate: isoDaysoMonths(monthsAgo),
        labName: "Demo Diagnostics Lab",
        requestingPhysician: "Dr. A. Demo",
      })
      .returning();

    await db.insert(bloodMarkers).values(
      MARKER_SPECS.map((spec) => {
        const value = spec.series[i];
        return {
          bloodTestId: test.id,
          name: spec.name,
          value,
          unit: spec.unit,
          referenceMin: spec.min,
          referenceMax: spec.max,
          status: markerStatus(value, spec.min, spec.max),
        };
      }),
    );
  }

  const [therapy] = await db
    .insert(therapies)
    .values({
      userId,
      patientId: patient.id,
      name: "Carboplatin + Pemetrexed",
      therapyType: "chemotherapy",
      startDate: isoDaysoMonths(6),
      dosage: "AUC 5 / 500 mg/m²",
      frequency: "Every 21 days",
      notes: "First-line chemotherapy. Well tolerated.",
    })
    .returning();

  await db.insert(therapyMedications).values([
    { therapyId: therapy.id, name: "Carboplatin", startDate: isoDaysoMonths(6), dosage: "AUC 5", frequency: "Day 1, q21d", route: "IV" },
    { therapyId: therapy.id, name: "Pemetrexed", startDate: isoDaysoMonths(6), dosage: "500 mg/m²", frequency: "Day 1, q21d", route: "IV" },
    { therapyId: therapy.id, name: "Dexamethasone", startDate: isoDaysoMonths(6), dosage: "4 mg", frequency: "BID x3 days around infusion", route: "PO" },
  ]);

  await db.insert(symptoms).values([
    { userId, patientId: patient.id, name: "Fatigue", severity: "moderate", startDate: isoDaysoMonths(5), notes: "Worse in the days after each cycle." },
    { userId, patientId: patient.id, name: "Nausea", severity: "mild", startDate: isoDaysoMonths(5), endDate: isoDaysoMonths(2), notes: "Controlled with antiemetics." },
  ]);

  await db.insert(analysisRuns).values({
    userId,
    patientId: patient.id,
    analysisType: "comprehensive",
    provider: "gemini",
    model: "gemini-2.5-flash",
    status: "completed",
    result: DEMO_ANALYSIS as unknown as Record<string, unknown>,
    inputDataIds: {},
    durationMs: 4200,
    completedAt: new Date(),
  });

  await seedDemoImaging(userId, patient.id);
  await seedDemoReportsIfMissing(userId, patient.id);
  await attachDemoSourceFilesIfMissing(patient.id);
}

/** Text reports + shared source-file paths. Idempotent for the report rows. */
async function seedDemoReportsIfMissing(userId: string, patientId: string): Promise<void> {
  const existing = await db
    .select({ id: medicalReports.id })
    .from(medicalReports)
    .where(eq(medicalReports.patientId, patientId))
    .limit(1);
  if (existing.length > 0) return;

  const [study] = await db
    .select({ id: imagingStudies.id })
    .from(imagingStudies)
    .where(eq(imagingStudies.patientId, patientId))
    .limit(1);

  await db.insert(medicalReports).values([
    {
      userId,
      patientId,
      reportType: "pathology",
      reportDate: isoDaysoMonths(6, -10),
      author: "Demo Pathology Dept.",
      institution: "Demo Cancer Center",
      title: "Lung core biopsy — adenocarcinoma",
      rawText: PATHOLOGY_REPORT,
      clinicalSpecialty: "Pathology",
      filePath: JSON.stringify([DEMO_SOURCE.pathology]),
    },
    {
      userId,
      patientId,
      reportType: "visit_note",
      reportDate: isoDaysoMonths(1),
      author: "Dr. A. Demo",
      institution: "Demo Cancer Center",
      title: "Oncology consultation — follow-up",
      rawText: ONCOLOGY_LETTER,
      clinicalSpecialty: "Oncology",
      filePath: JSON.stringify([DEMO_SOURCE.oncology]),
    },
    {
      userId,
      patientId,
      imagingStudyId: study?.id ?? null,
      reportType: "radiology",
      reportDate: demoImaging.study.studyDate,
      author: "Demo Radiology",
      institution: "Demo Cancer Center",
      title: "CT chest — restaging (demo)",
      rawText: RADIOLOGY_REPORT,
      clinicalSpecialty: "Radiology",
    },
  ]);
}

/**
 * Attach shared demo source images to 2 blood tests + pathology/oncology reports
 * when those rows exist but have no file_path yet.
 */
async function attachDemoSourceFilesIfMissing(patientId: string): Promise<void> {
  const oldest = await db
    .select({ id: bloodTests.id, filePath: bloodTests.filePath })
    .from(bloodTests)
    .where(eq(bloodTests.patientId, patientId))
    .orderBy(asc(bloodTests.testDate))
    .limit(1);
  const newest = await db
    .select({ id: bloodTests.id, filePath: bloodTests.filePath })
    .from(bloodTests)
    .where(eq(bloodTests.patientId, patientId))
    .orderBy(desc(bloodTests.testDate))
    .limit(1);

  if (oldest[0] && !oldest[0].filePath) {
    await db
      .update(bloodTests)
      .set({ filePath: JSON.stringify([DEMO_SOURCE.bloodPrior]) })
      .where(eq(bloodTests.id, oldest[0].id));
  }
  if (newest[0] && !newest[0].filePath && newest[0].id !== oldest[0]?.id) {
    await db
      .update(bloodTests)
      .set({ filePath: JSON.stringify([DEMO_SOURCE.bloodRecent]) })
      .where(eq(bloodTests.id, newest[0].id));
  } else if (newest[0] && !newest[0].filePath) {
    await db
      .update(bloodTests)
      .set({ filePath: JSON.stringify([DEMO_SOURCE.bloodRecent]) })
      .where(eq(bloodTests.id, newest[0].id));
  }

  await db
    .update(medicalReports)
    .set({ filePath: JSON.stringify([DEMO_SOURCE.pathology]) })
    .where(
      and(
        eq(medicalReports.patientId, patientId),
        eq(medicalReports.reportType, "pathology"),
        isNull(medicalReports.filePath),
      ),
    );

  await db
    .update(medicalReports)
    .set({ filePath: JSON.stringify([DEMO_SOURCE.oncology]) })
    .where(
      and(
        eq(medicalReports.patientId, patientId),
        eq(medicalReports.reportType, "visit_note"),
        isNull(medicalReports.filePath),
      ),
    );
}

/** Shared NLST chest CT — DB rows per user, one set of R2 objects for everyone. */
async function seedDemoImaging(userId: string, patientId: string): Promise<void> {
  const [study] = await db
    .insert(imagingStudies)
    .values({
      userId,
      patientId,
      modality: demoImaging.study.modality as Modality,
      studyDate: demoImaging.study.studyDate,
      bodyPart: demoImaging.study.bodyPart,
      description: demoImaging.study.description,
      seriesCount: demoImaging.study.seriesCount,
      instanceCount: demoImaging.study.instanceCount,
    })
    .returning({ id: imagingStudies.id });

  for (const s of demoImaging.series) {
    const [series] = await db
      .insert(imagingSeries)
      .values({
        studyId: study.id,
        seriesNumber: s.seriesNumber,
        description: s.description,
        modality: s.modality as Modality,
        instanceCount: s.instanceCount,
      })
      .returning({ id: imagingSeries.id });

    const rows = demoImaging.instances
      .filter((i) => i.seriesNumber === s.seriesNumber)
      .map((i) => ({
        seriesId: series.id,
        instanceNumber: i.instanceNumber,
        sopInstanceUid: i.sopInstanceUid,
        filePath: i.filePath,
      }));

    // Batch inserts — a single 150-row insert can time out on cold serverless DBs.
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      await db.insert(imagingInstances).values(rows.slice(i, i + BATCH));
    }
  }
}
