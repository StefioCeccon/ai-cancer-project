import { putObject, getObjectBytes } from "@/lib/storage";

/**
 * Shared demo source documents (one set of R2/local objects for every seeded user).
 * v2 = PDFs with built-in Helvetica (Sharp SVG text rendered blank on Vercel).
 */
export const DEMO_SOURCE = {
  bloodRecent: "/uploads/demo/v2/blood-panel-recent.pdf",
  bloodPrior: "/uploads/demo/v2/blood-panel-prior.pdf",
  pathology: "/uploads/demo/v2/pathology-report.pdf",
  oncology: "/uploads/demo/v2/oncology-note.pdf",
} as const;

async function objectPresent(webPath: string): Promise<boolean> {
  try {
    await getObjectBytes(webPath);
    return true;
  } catch {
    return false;
  }
}

/** Minimal one-page PDF using Helvetica (no font files needed). */
function buildPdf(title: string, subtitle: string, lines: string[]): Buffer {
  const escapePdf = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const contentLines: string[] = [
    "BT",
    "/F1 16 Tf",
    "50 780 Td",
    `(${escapePdf(title)}) Tj`,
    "/F1 10 Tf",
    "0 -18 Td",
    `(${escapePdf(subtitle)}) Tj`,
    "0 -28 Td",
    "/F1 11 Tf",
  ];

  for (const line of lines) {
    contentLines.push(`(${escapePdf(line)}) Tj`, "0 -16 Td");
  }

  contentLines.push(
    "/F1 9 Tf",
    "0 -28 Td",
    "(Fictional demo document - not a real medical record) Tj",
    "ET",
  );

  const stream = contentLines.join("\n");
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

async function ensureOne(webPath: string, build: () => Buffer): Promise<void> {
  if (await objectPresent(webPath)) return;
  await putObject(webPath, build(), "application/pdf");
}

/** Create shared demo PDFs on R2/local if missing (idempotent). */
export async function ensureDemoSourceFiles(): Promise<void> {
  await ensureOne(DEMO_SOURCE.bloodRecent, () =>
    buildPdf(
      "Demo Diagnostics Lab - Chemistry / Tumor Markers",
      "Collected: fictional recent panel | Patient: Jordan Rivera (demo)",
      [
        "Hemoglobin          12.4 g/dL     (12.0 - 16.0)",
        "White Blood Cells    6.0  10^9/L  (4.0 - 11.0)",
        "Platelets          247    10^9/L  (150 - 400)",
        "CEA                  6.2  ng/mL   (0 - 5.0)   H",
        "CA 19-9             34    U/mL    (0 - 37)",
        "Creatinine           0.90 mg/dL   (0.6 - 1.3)",
      ],
    ),
  );

  await ensureOne(DEMO_SOURCE.bloodPrior, () =>
    buildPdf(
      "Demo Diagnostics Lab - Chemistry / Tumor Markers",
      "Collected: fictional earlier panel | Patient: Jordan Rivera (demo)",
      [
        "Hemoglobin          10.4 g/dL     (12.0 - 16.0) L",
        "White Blood Cells    3.6  10^9/L  (4.0 - 11.0) L",
        "Platelets          142    10^9/L  (150 - 400) L",
        "CEA                 42.0  ng/mL   (0 - 5.0)   H",
        "CA 19-9             88    U/mL    (0 - 37)   H",
        "Creatinine           0.90 mg/dL   (0.6 - 1.3)",
      ],
    ),
  );

  await ensureOne(DEMO_SOURCE.pathology, () =>
    buildPdf(
      "Surgical Pathology Report",
      "Demo Cancer Center | Specimen: RUL lung core biopsy (fictional)",
      [
        "TTF-1: positive    Napsin A: positive    p40: negative",
        "Diagnosis: Adenocarcinoma, consistent with primary lung origin.",
        "Molecular: EGFR / ALK / ROS1 / PD-L1 requested.",
      ],
    ),
  );

  await ensureOne(DEMO_SOURCE.oncology, () =>
    buildPdf(
      "Oncology Consultation - Follow-up",
      "Demo Cancer Center | Dr. A. Demo (fictional)",
      [
        "Dx: NSCLC adenocarcinoma, stage IIIA.",
        "Completed 4 cycles carboplatin + pemetrexed; ECOG 1.",
        "CEA 42.0 -> 6.2 ng/mL - partial biochemical response.",
        "Plan: cycle 5; restaging CT in ~3 weeks.",
      ],
    ),
  );
}
