import { extractDocumentText } from "./extractDocumentText";
import { extractStructuredJson } from "./extractStructuredJson";
import { isSalvagedPartialJson } from "./parseJsonFromAi";
import type { ParsedTherapyEntry, TherapyType } from "@cancer-monitor/shared";

const VALID_THERAPY_TYPES = new Set<TherapyType>([
  "chemotherapy",
  "immunotherapy",
  "radiation",
  "surgery",
  "targeted_therapy",
  "hormone_therapy",
  "supportive_care",
  "other",
]);

const EXTRACTION_PROMPT = `You are a medical data extraction assistant. Extract treatments and therapies from the following clinical document text.

The document may be in any language (Italian, English, etc.). Return ONLY a valid JSON object with this exact structure:
{
  "sourceTitle": "document title or null",
  "therapies": [
    {
      "name": "therapy or regimen name in English",
      "therapyType": "chemotherapy",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "dosage": "overall dosage description",
      "frequency": "e.g. every 3 weeks",
      "notes": "additional context",
      "medications": [
        {
          "name": "drug name",
          "dosage": "e.g. 100mg",
          "frequency": "e.g. once daily",
          "route": "oral or IV",
          "notes": "null"
        }
      ]
    }
  ]
}

Field rules:
- Extract ALL active or planned treatments: chemo, immunotherapy, radiation, surgery, prescriptions, supportive care
- "therapyType": one of chemotherapy, immunotherapy, radiation, surgery, targeted_therapy, hormone_therapy, supportive_care, other
- Each distinct treatment line or regimen is a separate therapy entry
- Attach specific drugs to "medications" when listed
- "startDate": treatment start or prescription date; use document date if not specified; null if unknown
- "endDate": treatment end; null if ongoing or unknown
- "notes": max 80 characters; null if none
- Prefer short values — do not repeat long document text
- Translate names to English
- Do not invent treatments — only extract what is in the text
- Return only the JSON object, no explanation or markdown`;

export interface ParsedTherapyFile {
  fileName: string;
  rawText: string;
  sourceTitle: string | null;
  therapies: ParsedTherapyEntry[];
  warning?: string;
}

function normalizeTherapy(entry: ParsedTherapyEntry): ParsedTherapyEntry | null {
  if (!entry.name?.trim()) return null;
  const therapyType =
    entry.therapyType && VALID_THERAPY_TYPES.has(entry.therapyType)
      ? entry.therapyType
      : "other";
  const medications = (entry.medications ?? [])
    .filter((m) => m.name?.trim())
    .map((m) => ({
      name: m.name.trim(),
      dosage: m.dosage?.trim() || null,
      frequency: m.frequency?.trim() || null,
      route: m.route?.trim() || null,
      notes: m.notes?.trim() || null,
    }));

  return {
    name: entry.name.trim(),
    therapyType,
    startDate: entry.startDate ?? null,
    endDate: entry.endDate ?? null,
    dosage: entry.dosage?.trim() || null,
    frequency: entry.frequency?.trim() || null,
    notes: entry.notes?.trim() || null,
    medications,
  };
}

export async function parseTherapyFile(file: File): Promise<ParsedTherapyFile> {
  const rawText = (await extractDocumentText(file)).trim();
  if (!rawText) {
    return {
      fileName: file.name,
      rawText: "",
      sourceTitle: null,
      therapies: [],
      warning: "Could not extract text from file",
    };
  }

  try {
    const { data } = await extractStructuredJson(EXTRACTION_PROMPT, rawText);
    const parsed = data as { sourceTitle?: string | null; therapies?: ParsedTherapyEntry[] };

    const therapies = (parsed.therapies ?? [])
      .map((t) => normalizeTherapy(t))
      .filter((t): t is ParsedTherapyEntry => t !== null);

    const partial = isSalvagedPartialJson(data);

    if (therapies.length === 0) {
      return {
        fileName: file.name,
        rawText,
        sourceTitle: parsed.sourceTitle ?? null,
        therapies: [],
        warning: "No therapies found in document — add them manually below",
      };
    }

    return {
      fileName: file.name,
      rawText,
      sourceTitle: parsed.sourceTitle ?? null,
      therapies,
      ...(partial
        ? {
            warning: `Extracted ${therapies.length} therapies; response was truncated — review and add any missing entries`,
          }
        : {}),
    };
  } catch (err) {
    console.error("Therapy AI extraction failed:", err);
    return {
      fileName: file.name,
      rawText,
      sourceTitle: null,
      therapies: [],
      warning: "AI extraction failed — therapies may need manual entry",
    };
  }
}
