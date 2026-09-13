export type AIProvider = "gemini" | "openai" | "anthropic" | "mistral";
export type AnalysisStatus = "pending" | "running" | "completed" | "failed";
export type AnalysisType =
  | "cancer_progression"
  | "biomarker_trend"
  | "imaging_findings"
  | "treatment_response"
  | "risk_assessment"
  | "next_steps"
  | "comprehensive"
  | "ml_imaging"
  | "mdt_consultation";

export type MDTSpecialistRole =
  | "radiologist"
  | "endocrinologist"
  | "pathologist"
  | "palliative"
  | "research_doctor"
  | "clinical_trials"
  | "oncologist";

export interface MDTSpecialistReport {
  role: MDTSpecialistRole;
  report: string;
  completedAt: string;
}

export interface MDTDocument {
  id: string;
  type: "imaging" | "report" | "blood_test";
  date: string;
  title: string;
  fullContent: string;
}

export interface MDTFollowUpRound {
  round: number;
  questions: Array<{ role: MDTSpecialistRole; question: string }>;
  answers: Partial<Record<MDTSpecialistRole, string>>;
  synthesisDraft: string;
}

export interface MDTConsultationResult {
  specialists: Partial<Record<MDTSpecialistRole, MDTSpecialistReport>>;
  discussions: Partial<Record<MDTSpecialistRole, string>>;
  followUpRounds: MDTFollowUpRound[];
  synthesis?: MDTSpecialistReport;
}

export type MDTSSEEvent =
  | { type: "specialist_selecting"; role: MDTSpecialistRole; selectedTitles: string[] }
  | { type: "specialist"; role: MDTSpecialistRole; report: string; completedAt: string }
  | { type: "discussion"; role: MDTSpecialistRole; comment: string; completedAt: string }
  | { type: "synthesis_draft"; report: string; round: number; completedAt: string }
  | { type: "followup_question"; toRole: MDTSpecialistRole; question: string; round: number }
  | { type: "followup_answer"; role: MDTSpecialistRole; answer: string; round: number; completedAt: string }
  | { type: "phase"; phase: "discussion" | "synthesis" | "followup"; round?: number }
  | { type: "synthesis"; report: string; completedAt: string }
  | { type: "done"; runId: string }
  | { type: "error"; message: string };

export interface AnalysisRun {
  id: string;
  patientId: string;
  analysisType: AnalysisType;
  provider: AIProvider;
  model: string;
  status: AnalysisStatus;
  prompt?: string;
  result?: AnalysisResult;
  errorMessage?: string;
  durationMs?: number;
  inputDataIds: {
    imagingStudyIds?: string[];
    bloodTestIds?: string[];
    reportIds?: string[];
  };
  createdAt: string;
  completedAt?: string;
}

export interface AnalysisResult {
  summary: string;
  cancerSigns?: CancerSign[];
  progression?: ProgressionAssessment;
  nextSteps?: NextStep[];
  riskFactors?: RiskFactor[];
  confidenceScore?: number;
  disclaimer: string;
  structuredData?: Record<string, unknown>;
  imagingAnalysis?: ImagingAnalysisSummary[];
}

export interface ImagingAnalysisSummary {
  studyId: string;
  modality: string;
  bodyPart?: string;
  studyDate?: string;
  mlModel?: string;
  riskScore?: number;
  riskScoreLabel?: string;
  riskLevel?: string;
  highRiskSlices?: number[];
  seriesNumber?: number;
  flaggedFindings: string[];
  linkedReportSummary?: string;
}

export interface CancerSign {
  finding: string;
  source: "imaging" | "bloodtest" | "report" | "combined";
  severity: "mild" | "moderate" | "severe";
  confidence: number;
}

export interface ProgressionAssessment {
  trend: "improving" | "stable" | "worsening" | "unknown";
  description: string;
  comparedPeriod?: string;
  keyIndicators: string[];
}

export interface NextStep {
  action: string;
  priority: "low" | "medium" | "high" | "urgent";
  timeframe?: string;
  rationale: string;
}

export interface RiskFactor {
  factor: string;
  level: "low" | "medium" | "high";
  description: string;
}
