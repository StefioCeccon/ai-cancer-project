import { GoogleGenerativeAI } from "@google/generative-ai";
import { resolveProviderKey } from "@/lib/ai/keys";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg"] as const;
type ImageMimeType = "image/jpeg" | "image/png";

async function getGeminiClient() {
  const apiKey = await resolveProviderKey("gemini");
  if (!apiKey) throw new Error("No Gemini API key configured");
  return new GoogleGenerativeAI(apiKey);
}

const OCR_PROMPT =
  "This is a medical document. Extract ALL text from it exactly as it appears. Preserve line breaks and structure. Return only the raw text, no explanations.";

async function ocrWithGemini(buffer: Buffer, mimeType: ImageMimeType | "application/pdf"): Promise<string> {
  const model = (await getGeminiClient()).getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent([
    { inlineData: { mimeType, data: buffer.toString("base64") } },
    OCR_PROMPT,
  ]);
  return result.response.text();
}

function isScannedPdf(text: string): boolean {
  return text.replace(/\s+/g, "").length < 80;
}

export async function extractDocumentText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const isImage =
    VALID_IMAGE_TYPES.includes(file.type as (typeof VALID_IMAGE_TYPES)[number]) ||
    /\.(jpe?g|png)$/i.test(file.name);
  const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

  if (isPdf) {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    if (isScannedPdf(data.text)) {
      return ocrWithGemini(buffer, "application/pdf");
    }
    return data.text;
  }

  if (isImage) {
    const mimeType: ImageMimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    return ocrWithGemini(buffer, mimeType);
  }

  return new TextDecoder().decode(buffer);
}
