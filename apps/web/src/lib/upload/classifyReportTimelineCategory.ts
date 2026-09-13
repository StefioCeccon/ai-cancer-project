import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeReportTimelineCategory } from "@/lib/timeline/timelineLaneKeys";
import { TIMELINE_CATEGORY_OPTIONS } from "@/lib/timeline/timelineCategoryOptions";
import { resolveProviderKey } from "@/lib/ai/keys";

export interface ClassifyReportTimelineCategoryInput {
  title: string;
  reportType?: string | null;
}

/** Exam/imaging categories — checked before clinical specialty visits. Order matters. */
const TITLE_CATEGORY_RULES: { category: string; patterns: RegExp[] }[] = [
  {
    category: "Angiology",
    patterns: [
      /\becocolordoppler\b/i,
      /\becodoppler\b/i,
      /\bdoppler\s+(venoso|arterioso|arti|vascolare)\b/i,
      /\bangio[\s-]?tc\b/i,
      /\bangiograf/i,
      /\bangiologia\b/i,
      /\bmap\s+venoso\b/i,
    ],
  },
  {
    category: "Tomographies",
    patterns: [
      /\btac\b/i,
      /\bt\.?\s*c\.?\b/i,
      /\btomograf/i,
      /\bpet[\s-]?tc\b/i,
      /\bpet\b/i,
      /\brmn\b/i,
      /\br\.?\s*m\.?\s*n\.?\b/i,
      /\brisonanza\s+magnetica/i,
      /\bmri\b/i,
      /\bct\s+(scan|massiccio|torace|addome|faciale|encefalo)\b/i,
    ],
  },
  {
    category: "Radiography",
    patterns: [
      /\bradiograf/i,
      /\brx\b/i,
      /\bx[\s-]?ray\b/i,
      /\bortopanoram/i,
    ],
  },
  {
    category: "Ultrasound",
    patterns: [/\becograf/i, /\bultrasound\b/i],
  },
  {
    category: "Pathology",
    patterns: [/\bhistolog/i, /\bbiops/i, /\bpatolog/i, /\bcitolog/i],
  },
  {
    category: "Oncology",
    patterns: [
      /\boncolog/i,
      /\bchemioterap/i,
      /\bchemotherapy\b/i,
      /\bimmunoterap/i,
      /\btumor\b/i,
      /\bneoplas/i,
      /\bvisita\s+oncolog/i,
      /\bcontrollo\s+oncolog/i,
    ],
  },
  {
    category: "Neurology",
    patterns: [/\bvisita\s+neurolog/i, /\bcontrollo\s+neurolog/i, /\bictus\b/i],
  },
  {
    category: "Gastroenterology",
    patterns: [/\bgastroenterolog/i, /\bepatolog/i, /\bcolonoscop/i, /\bgastroscop/i],
  },
  {
    category: "Cardiology",
    patterns: [/\bcardiolog/i, /\becocardiogram/i, /\bholter\b/i],
  },
  {
    category: "Otorhinolaryngology",
    patterns: [
      /\botorhinolaryngolog/i,
      /\boto[\s-]?rhino/i,
      /\blaringolog/i,
      /\borl\b/i,
      /\bent\b/i,
    ],
  },
  {
    category: "Orthopedics",
    patterns: [
      /\borthopa?edic/i,
      /\bphysioth/i,
      /\bphisioth/i,
      /\bphysical\s+therap/i,
      /\bfisioterap/i,
    ],
  },
];

const LEGACY_IMAGING_CATEGORIES = new Set(["Radiology"]);

export const REPORT_TIMELINE_CATEGORIES = TIMELINE_CATEGORY_OPTIONS;

function isTomographyTitle(title: string): boolean {
  return /\b(tac|t\.?\s*c\.?|tomograf|rmn|pet|mri|risonanza\s+magnetica)\b/i.test(title);
}

/** Fast title-only rules for common Italian/English report titles. */
export function classifyReportTimelineCategoryFromRules(
  input: ClassifyReportTimelineCategoryInput
): string | null {
  const title = input.title.trim();
  if (!title) return null;

  for (const rule of TITLE_CATEGORY_RULES) {
    if (!rule.patterns.some((p) => p.test(title))) continue;
    if (rule.category === "Radiography" && isTomographyTitle(title)) continue;
    return rule.category;
  }

  if (input.reportType === "pathology") return "Pathology";
  if (input.reportType === "radiology") return "Radiography";

  return null;
}

/** Assign a timeline group from the parsed report title. */
export async function classifyReportTimelineCategory(
  input: ClassifyReportTimelineCategoryInput
): Promise<string | null> {
  const title = input.title.trim();
  if (!title) return null;

  const fromRules = classifyReportTimelineCategoryFromRules(input);
  if (fromRules) return fromRules;

  const apiKey = await resolveProviderKey("gemini");
  if (!apiKey) return null;

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const categories = REPORT_TIMELINE_CATEGORIES.join(", ");

    const result = await model.generateContent(`Assign a timeline category for this medical report TITLE.

Return JSON:
{
  "category": "One of: ${categories}, or null if unclear."
}

Rules — use ONLY the title:
- Group by exam/visit type, not hospital department.
- Ecocolordoppler / doppler venoso / angiografia → Angiology (NOT Tomographies or generic Radiology).
- TC / TAC / tomografia / RMN / MRI / PET → Tomographies (NOT Radiography).
- RX / radiografia / X-ray only → Radiography.
- Plain ecografia (without doppler) → Ultrasound.
- Oncology clinic visits → Oncology.
- Physiotherapy / fisioterapia / physical therapy → Orthopedics (same row as orthopedic visits).
- Italian examples:
  - "Ecocolordoppler venoso arti inferiori" → Angiology
  - "TC massiccio faciale" → Tomographies
  - "RMN encefalo con contrasto" → Tomographies
  - "Visita oncologica di controllo" → Oncology
  - "Otorhinolaryngology Visit Report" → Otorhinolaryngology
  - "Seduta fisioterapia ginocchio" → Orthopedics
  - "Physiotherapy progress note" → Orthopedics

${input.reportType ? `Document type (weak hint): ${input.reportType}\n` : ""}
Title:
${title}

Return ONLY valid JSON.`);

    const parsed = JSON.parse(result.response.text()) as { category?: string | null };
    const category = parsed.category?.trim();
    if (!category) return null;
    return normalizeReportTimelineCategory(category);
  } catch {
    return null;
  }
}

export function shouldRefreshTimelineCategory(
  stored: string | null | undefined,
  input: ClassifyReportTimelineCategoryInput
): boolean {
  if (!input.title.trim()) return false;
  if (stored === null || stored === undefined) return true;

  const trimmed = stored.trim();
  if (!trimmed) return true;
  if (LEGACY_IMAGING_CATEGORIES.has(trimmed)) return true;

  const normalizedStored = normalizeReportTimelineCategory(trimmed);
  if (normalizedStored !== trimmed) return true;

  const fromRules = classifyReportTimelineCategoryFromRules(input);
  if (fromRules && fromRules !== normalizedStored) return true;

  return false;
}
