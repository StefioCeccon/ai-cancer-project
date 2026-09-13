import { getProvider } from "@/lib/ai";
import { getDefaultProviderForUser } from "@/lib/ai/keys";
import { extractDocumentText } from "./extractDocumentText";
import { mergeBloodMarkers, type ParsedBloodMarker } from "./bloodMarkers";

export { mergeBloodMarkers, type ParsedBloodMarker };

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

const EXTRACTION_PROMPT = `You are a medical data extraction assistant. Extract structured data from the following lab report text.

The report may be in any language (Italian, English, etc.). Return ONLY a valid JSON object with this exact structure:
{
  "testDate": "YYYY-MM-DD or null",
  "labName": "laboratory name string or null",
  "markers": [
    {
      "name": "marker name in English (translate if needed)",
      "value": 12.5,
      "unit": "unit string",
      "referenceMin": 10.0,
      "referenceMax": 20.0
    }
  ]
}

Rules:
- "testDate": the date the blood was drawn or the report date, formatted as YYYY-MM-DD. null if not found.
- "labName": the name of the laboratory or clinic that issued the report. null if not found.
- "name" must be in English (e.g. "Hemoglobin", "White Blood Cells", "CA 19-9")
- "value" must be a number (use . as decimal separator, not comma)
- "unit" is the measurement unit as-is from the document
- "referenceMin" and "referenceMax" are numbers if present in the document, otherwise null
- Include ALL markers found, not just cancer markers
- Do not invent values — only extract what is explicitly in the text
- Return only the JSON object, no explanation`;

export interface ParsedBloodTestFile {
  fileName: string;
  rawText: string;
  markers: ParsedBloodMarker[];
  testDate: string | null;
  labName: string | null;
  warning?: string;
}

async function extractTextFromFile(file: File): Promise<string> {
  return extractDocumentText(file);
}

export async function parseBloodTestFile(file: File): Promise<ParsedBloodTestFile> {
  const rawText = (await extractTextFromFile(file)).trim();
  if (!rawText) {
    return {
      fileName: file.name,
      rawText: "",
      markers: [],
      testDate: null,
      labName: null,
      warning: "Could not extract text from file",
    };
  }

  try {
    const providerName = await getDefaultProviderForUser();
    const provider = getProvider(providerName);

    const response = await provider.chat({
      provider: providerName,
      model:
        providerName === "gemini"
          ? "gemini-2.5-flash"
          : providerName === "openai"
            ? "gpt-4o-mini"
            : "claude-haiku-4-5-20251001",
      jsonMode: true,
      messages: [{ role: "user", content: `${EXTRACTION_PROMPT}\n\n---\n\n${rawText}` }],
      temperature: 0,
      maxTokens: 16384,
    });

    const parsed = JSON.parse(response.content);
    const markers = (parsed.markers ?? [])
      .map((m: ParsedBloodMarker) => ({
        name: m.name,
        value: toNumber(m.value),
        unit: m.unit ?? "",
        referenceMin: toNumber(m.referenceMin),
        referenceMax: toNumber(m.referenceMax),
      }))
      .filter(
        (m: ParsedBloodMarker): m is ParsedBloodMarker =>
          !!m.name && m.value !== undefined && !isNaN(m.value)
      );

    return {
      fileName: file.name,
      rawText,
      markers,
      testDate: parsed.testDate ?? null,
      labName: parsed.labName ?? null,
    };
  } catch {
    return {
      fileName: file.name,
      rawText,
      markers: [],
      testDate: null,
      labName: null,
      warning: "AI extraction failed — markers may need manual entry",
    };
  }
}
