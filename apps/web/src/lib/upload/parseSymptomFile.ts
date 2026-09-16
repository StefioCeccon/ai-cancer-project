import { extractDocumentText } from "./extractDocumentText";
import { extractStructuredJson } from "./extractStructuredJson";
import { isSalvagedPartialJson } from "./parseJsonFromAi";
import type { ParsedSymptomEntry, SymptomSeverity } from "@ai-cancer-project/shared";

const EXTRACTION_PROMPT = `You are a medical data extraction assistant. Extract patient symptoms from the following clinical document text.

The document may be in any language (Italian, English, etc.). Return ONLY a valid JSON object with this exact structure:
{
  "sourceTitle": "document title or null",
  "symptoms": [
    {
      "name": "symptom name in English",
      "severity": "mild",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "notes": "brief context"
    }
  ]
}

Field rules:
- "sourceTitle": document title if identifiable, otherwise null
- "symptoms": array of every symptom or clinical event mentioned
- "name": symptom or event name in English (translate if needed); keep concise
- "severity": one of "mild", "moderate", "severe", or null if not stated
- "startDate": YYYY-MM-DD when known; YYYY-MM if only month known; null if unknown
- "endDate": YYYY-MM-DD when resolved; null if ongoing or unknown
- "notes": max 80 characters; null if none
- Prefer short values — do not repeat long document text in notes
- Do not invent symptoms — only extract what is in the text
- Return only the JSON object, no explanation or markdown`;

const VALID_SEVERITIES = new Set<SymptomSeverity>(["mild", "moderate", "severe"]);

export interface ParsedSymptomFile {
  fileName: string;
  rawText: string;
  sourceTitle: string | null;
  symptoms: ParsedSymptomEntry[];
  warning?: string;
}

function normalizeSymptom(entry: ParsedSymptomEntry): ParsedSymptomEntry | null {
  if (!entry.name?.trim()) return null;
  const severity =
    entry.severity && VALID_SEVERITIES.has(entry.severity) ? entry.severity : null;
  return {
    name: entry.name.trim(),
    severity,
    startDate: entry.startDate ?? null,
    endDate: entry.endDate ?? null,
    notes: entry.notes?.trim() || null,
  };
}

export async function parseSymptomFile(file: File): Promise<ParsedSymptomFile> {
  const rawText = (await extractDocumentText(file)).trim();
  if (!rawText) {
    return {
      fileName: file.name,
      rawText: "",
      sourceTitle: null,
      symptoms: [],
      warning: "Could not extract text from file",
    };
  }

  try {
    const { data } = await extractStructuredJson(EXTRACTION_PROMPT, rawText);
    const parsed = data as { sourceTitle?: string | null; symptoms?: ParsedSymptomEntry[] };

    const symptoms = (parsed.symptoms ?? [])
      .map((s) => normalizeSymptom(s))
      .filter((s): s is ParsedSymptomEntry => s !== null);

    const partial = isSalvagedPartialJson(data);

    if (symptoms.length === 0) {
      return {
        fileName: file.name,
        rawText,
        sourceTitle: parsed.sourceTitle ?? null,
        symptoms: [],
        warning: "No symptoms found in document — add them manually below",
      };
    }

    return {
      fileName: file.name,
      rawText,
      sourceTitle: parsed.sourceTitle ?? null,
      symptoms,
      ...(partial
        ? {
            warning: `Extracted ${symptoms.length} symptoms; response was truncated — review and add any missing entries`,
          }
        : {}),
    };
  } catch (err) {
    console.error("Symptom AI extraction failed:", err);
    return {
      fileName: file.name,
      rawText,
      sourceTitle: null,
      symptoms: [],
      warning: "AI extraction failed — symptoms may need manual entry",
    };
  }
}
