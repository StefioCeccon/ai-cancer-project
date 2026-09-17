import sharp from "sharp";
import { putObject, getObjectBytes } from "@/lib/storage";

/**
 * Shared demo source documents (one set of R2/local objects for every seeded user).
 * Paths are stable so we never duplicate bytes per visitor.
 */
export const DEMO_SOURCE = {
  bloodRecent: "/uploads/demo/blood-panel-recent.png",
  bloodPrior: "/uploads/demo/blood-panel-prior.png",
  pathology: "/uploads/demo/pathology-report.png",
  oncology: "/uploads/demo/oncology-note.png",
} as const;

async function objectPresent(webPath: string): Promise<boolean> {
  try {
    await getObjectBytes(webPath);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function pngFromLines(
  title: string,
  subtitle: string,
  lines: string[],
  accent = "#1e40af",
): Promise<Buffer> {
  const lineHeight = 22;
  const pad = 36;
  const width = 700;
  const height = pad * 2 + 72 + lines.length * lineHeight + 40;
  const body = lines
    .map(
      (line, i) =>
        `<text x="${pad}" y="${pad + 88 + i * lineHeight}" font-size="14" font-family="ui-monospace, Menlo, monospace" fill="#334155">${escapeXml(line)}</text>`,
    )
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <rect x="0" y="0" width="100%" height="8" fill="${accent}"/>
  <text x="${pad}" y="${pad + 18}" font-size="20" font-weight="700" font-family="system-ui, sans-serif" fill="#0f172a">${escapeXml(title)}</text>
  <text x="${pad}" y="${pad + 42}" font-size="13" font-family="system-ui, sans-serif" fill="#64748b">${escapeXml(subtitle)}</text>
  <line x1="${pad}" y1="${pad + 56}" x2="${width - pad}" y2="${pad + 56}" stroke="#cbd5e1" stroke-width="1"/>
  ${body}
  <text x="${pad}" y="${height - 16}" font-size="11" font-family="system-ui, sans-serif" fill="#94a3b8">Fictional demo document — not a real medical record</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function ensureOne(webPath: string, build: () => Promise<Buffer>): Promise<void> {
  if (await objectPresent(webPath)) return;
  const body = await build();
  await putObject(webPath, body, "image/png");
}

/** Create shared demo PNGs on R2/local if missing (idempotent). */
export async function ensureDemoSourceFiles(): Promise<void> {
  await ensureOne(DEMO_SOURCE.bloodRecent, () =>
    pngFromLines(
      "Demo Diagnostics Lab — Chemistry / Tumor Markers",
      "Collected: fictional recent panel · Patient: Jordan Rivera (demo)",
      [
        "Hemoglobin          12.4 g/dL     (12.0 – 16.0)",
        "White Blood Cells    6.0  10^9/L  (4.0 – 11.0)",
        "Platelets          247    10^9/L  (150 – 400)",
        "CEA                  6.2  ng/mL   (0 – 5.0)   H",
        "CA 19-9             34    U/mL    (0 – 37)",
        "Creatinine           0.90 mg/dL   (0.6 – 1.3)",
      ],
      "#0369a1",
    ),
  );

  await ensureOne(DEMO_SOURCE.bloodPrior, () =>
    pngFromLines(
      "Demo Diagnostics Lab — Chemistry / Tumor Markers",
      "Collected: fictional earlier panel · Patient: Jordan Rivera (demo)",
      [
        "Hemoglobin          10.4 g/dL     (12.0 – 16.0) L",
        "White Blood Cells    3.6  10^9/L  (4.0 – 11.0) L",
        "Platelets          142    10^9/L  (150 – 400) L",
        "CEA                 42.0  ng/mL   (0 – 5.0)   H",
        "CA 19-9             88    U/mL    (0 – 37)   H",
        "Creatinine           0.90 mg/dL   (0.6 – 1.3)",
      ],
      "#0369a1",
    ),
  );

  await ensureOne(DEMO_SOURCE.pathology, () =>
    pngFromLines(
      "Surgical Pathology Report",
      "Demo Cancer Center · Specimen: RUL lung core biopsy (fictional)",
      [
        "TTF-1: positive    Napsin A: positive    p40: negative",
        "Diagnosis: Adenocarcinoma, consistent with primary lung origin.",
        "Molecular: EGFR / ALK / ROS1 / PD-L1 requested.",
      ],
      "#7c2d12",
    ),
  );

  await ensureOne(DEMO_SOURCE.oncology, () =>
    pngFromLines(
      "Oncology Consultation — Follow-up",
      "Demo Cancer Center · Dr. A. Demo (fictional)",
      [
        "Dx: NSCLC adenocarcinoma, stage IIIA.",
        "Completed 4 cycles carboplatin + pemetrexed; ECOG 1.",
        "CEA 42.0 → 6.2 ng/mL — partial biochemical response.",
        "Plan: cycle 5; restaging CT in ~3 weeks.",
      ],
      "#1e3a8a",
    ),
  );
}
