import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ReportType } from "@cancer-monitor/shared";
import { extractDocumentText } from "./extractDocumentText";
import { resolveProviderKey } from "@/lib/ai/keys";

export interface ParsedReportMetadata {
  date: string | null;
  reportType: ReportType | null;
  institution: string | null;
  author: string | null;
  title: string | null;
}

export interface ParsedReportFile {
  fileName: string;
  text: string;
  metadata: ParsedReportMetadata;
}

export async function extractReportMetadata(text: string): Promise<ParsedReportMetadata> {
  const fallback: ParsedReportMetadata = {
    date: null,
    reportType: null,
    institution: null,
    author: null,
    title: null,
  };
  const apiKey = await resolveProviderKey("gemini");
  if (!apiKey) return fallback;

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(`From this medical document text, extract the following metadata and return as JSON.

{
  "date": "Date of the report in YYYY-MM-DD format. Null if not found.",
  "reportType": "One of: visit_note, pathology, radiology, discharge_summary, treatment_plan, prescription, referral, other. Best match based on content.",
  "institution": "Hospital, clinic, or lab name. Null if not found.",
  "author": "Doctor or author name (e.g. Dr. Rossi). Null if not found.",
  "title": "A concise descriptive title for this report (max 80 chars). This title groups reports on the patient timeline — name the exam or visit type specifically (e.g. 'Ecocolordoppler venoso arti inferiori', 'TC massiccio faciale', 'Visita oncologica di controllo', 'RMN encefalo con contrasto'). Use exam names (TC, ecocolordoppler, RMN) not generic 'Radiology' or department names."
}

Bulk upload context (important for grouping):
- This file is one of many being uploaded together. Each file is usually a separate report — typically a single page. Multi-page reports exist but are uncommon (usually at most 3–4 pages).
- Assume this is its own report unless the text clearly indicates it is a continuation page (e.g. "page 2 of 3").
- Write a specific, distinctive title for THIS document so unrelated uploads from the same day or institution are not merged. Include distinguishing details when visible (visit focus, procedure, doctor name, page number if continuation).

Document text (first 4000 chars):
${text.slice(0, 4000)}

Return ONLY valid JSON matching the schema above.`);

    const parsed = JSON.parse(result.response.text()) as ParsedReportMetadata;
    return {
      date: parsed.date ?? null,
      reportType: parsed.reportType ?? null,
      institution: parsed.institution ?? null,
      author: parsed.author ?? null,
      title: parsed.title ?? null,
    };
  } catch {
    return fallback;
  }
}

export async function parseReportFile(file: File): Promise<ParsedReportFile> {
  const text = await extractDocumentText(file);
  const metadata = await extractReportMetadata(text);
  return { fileName: file.name, text: text.trim(), metadata };
}
