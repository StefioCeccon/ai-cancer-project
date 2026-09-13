import type { AnalysisResult, AnalysisType, AIProvider } from "@cancer-monitor/shared";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIRequestOptions {
  provider: AIProvider;
  model: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  /**
   * Explicit API key. When omitted, the provider resolves the key from the
   * current user's saved key (request-scoped) or the server env var.
   */
  apiKey?: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIProvider_Interface {
  name: AIProvider;
  chat(options: AIRequestOptions): Promise<AIResponse>;
  isConfigured(): boolean;
}

export interface OncologyAnalysisRequest {
  patientContext: string;
  analysisType: AnalysisType;
  therapyData?: string;
  symptomData?: string;
  bloodTestData?: string;
  imagingFindings?: string;
  reportData?: string;
  locale?: string;
}
