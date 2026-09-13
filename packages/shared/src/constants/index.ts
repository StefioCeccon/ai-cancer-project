export const SUPPORTED_LOCALES = ["en", "it", "es", "fr", "de", "pt"] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: Locale = "en";

export const CANCER_TYPES = [
  "Breast Cancer",
  "Lung Cancer",
  "Colorectal Cancer",
  "Prostate Cancer",
  "Melanoma",
  "Bladder Cancer",
  "Non-Hodgkin Lymphoma",
  "Kidney Cancer",
  "Endometrial Cancer",
  "Leukemia",
  "Pancreatic Cancer",
  "Thyroid Cancer",
  "Liver Cancer",
  "Cervical Cancer",
  "Ovarian Cancer",
  "Other",
] as const;

export const CANCER_STAGES = ["0", "I", "IA", "IB", "II", "IIA", "IIB", "III", "IIIA", "IIIB", "IIIC", "IV", "IVA", "IVB", "Unknown"] as const;

export const AI_MODELS: Record<string, { provider: string; label: string; contextWindow: number }> = {
  "gemini-2.5-flash": { provider: "gemini", label: "Gemini 2.5 Flash", contextWindow: 1048576 },
  "gemini-2.0-flash": { provider: "gemini", label: "Gemini 2.0 Flash", contextWindow: 1048576 },
  "gemini-1.5-pro": { provider: "gemini", label: "Gemini 1.5 Pro", contextWindow: 2097152 },
  "gpt-4o": { provider: "openai", label: "GPT-4o", contextWindow: 128000 },
  "gpt-4-turbo": { provider: "openai", label: "GPT-4 Turbo", contextWindow: 128000 },
  "claude-opus-4-7": { provider: "anthropic", label: "Claude Opus 4.7", contextWindow: 200000 },
  "claude-sonnet-4-6": { provider: "anthropic", label: "Claude Sonnet 4.6", contextWindow: 200000 },
  "mistral-large": { provider: "mistral", label: "Mistral Large", contextWindow: 128000 },
};

export const MAX_FILE_SIZE_MB = 500;
export const ACCEPTED_IMAGING_TYPES = [".dcm", ".zip"];
export const ACCEPTED_REPORT_TYPES = [".pdf", ".txt", ".docx"];
export const ACCEPTED_BLOODTEST_TYPES = [".pdf", ".csv", ".txt", ".jpg", ".jpeg", ".png"];
