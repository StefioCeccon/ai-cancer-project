"use client";

import { useState, useEffect } from "react";
import {
  BrainCircuit, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Clock, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type { AnalysisResult, AnalysisType, AIProvider, ProgressionAssessment, ImagingAnalysisSummary } from "@ai-cancer-project/shared";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { AI_MODELS } from "@ai-cancer-project/shared";
import { AnalysisContextSelector, estimateAnalysisContext } from "@/components/analysis/AnalysisContextSelector";
import type {
  ReportContextItem,
  BloodTestContextItem,
  ImagingContextItem,
} from "@/lib/ai/contextEstimate";

interface InputDataIds {
  bloodTestIds?: string[];
  reportIds?: string[];
  imagingStudyIds?: string[];
}

interface LoadedRunMeta {
  id: string;
  analysisType: AnalysisType;
  model: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  errorMessage?: string | null;
  inputDataIds?: InputDataIds;
}

interface PatientAnalysisData {
  reports: ReportContextItem[];
  bloodTests: BloodTestContextItem[];
  imagingStudies: ImagingContextItem[];
}

interface AnalysisPanelProps {
  patientId: string;
  patientData: PatientAnalysisData;
  configuredProviders?: AIProvider[];
  initialAnalysisType?: AnalysisType;
  strategyContext?: string;
  loadedRun?: LoadedRunMeta | null;
  loadedResult?: AnalysisResult | null;
  onClearLoadedRun?: () => void;
  onComplete?: (runId: string) => void;
}

const analysisTypes: { id: AnalysisType; label: string; description: string }[] = [
  { id: "comprehensive", label: "Comprehensive", description: "Full multi-modal analysis" },
  { id: "cancer_progression", label: "Progression", description: "Track cancer progression over time" },
  { id: "biomarker_trend", label: "Biomarkers", description: "Analyze blood marker trends" },
  { id: "imaging_findings", label: "Imaging", description: "Extract imaging findings" },
  { id: "ml_imaging", label: "ML Imaging", description: "ML model analysis of imaging studies" },
  { id: "treatment_response", label: "Treatment Response", description: "Evaluate response to treatment" },
  { id: "risk_assessment", label: "Risk Assessment", description: "Overall risk evaluation" },
  { id: "next_steps", label: "Next Steps", description: "Recommended clinical actions" },
];

export function AnalysisPanel({
  patientId,
  patientData,
  configuredProviders = ["gemini"],
  initialAnalysisType,
  strategyContext,
  loadedRun,
  loadedResult,
  onClearLoadedRun,
  onComplete,
}: AnalysisPanelProps) {
  const [selectedType, setSelectedType] = useState<AnalysisType>(initialAnalysisType ?? "comprehensive");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [selectedBloodTestIds, setSelectedBloodTestIds] = useState<string[]>([]);
  const [selectedImagingIds, setSelectedImagingIds] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const { reports, bloodTests, imagingStudies } = patientData;

  // Default: all items selected when patient data loads
  useEffect(() => {
    if (loadedRun) return;
    setSelectedReportIds(reports.map((r) => r.id));
    setSelectedBloodTestIds(bloodTests.map((b) => b.id));
    setSelectedImagingIds(imagingStudies.map((s) => s.id));
  }, [reports, bloodTests, imagingStudies, loadedRun]);

  useEffect(() => {
    if (initialAnalysisType) setSelectedType(initialAnalysisType);
  }, [initialAnalysisType]);

  useEffect(() => {
    if (!loadedRun) return;
    setSelectedType(loadedRun.analysisType);
    setSelectedModel(loadedRun.model);
    setRunId(loadedRun.id);
    setResult(loadedResult ?? null);
    setError(loadedRun.status === "failed" ? loadedRun.errorMessage ?? "Analysis failed" : null);
    const ids = loadedRun.inputDataIds ?? {};
    setSelectedReportIds(ids.reportIds ?? []);
    setSelectedBloodTestIds(ids.bloodTestIds ?? []);
    setSelectedImagingIds(ids.imagingStudyIds ?? []);
  }, [loadedRun, loadedResult]);

  function clearLoadedRun() {
    setResult(null);
    setError(null);
    setRunId(null);
    setSelectedReportIds(reports.map((r) => r.id));
    setSelectedBloodTestIds(bloodTests.map((b) => b.id));
    setSelectedImagingIds(imagingStudies.map((s) => s.id));
    onClearLoadedRun?.();
  }

  function toggleId(id: string, setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const availableModels = Object.entries(AI_MODELS).filter(([, m]) =>
    configuredProviders.includes(m.provider as AIProvider)
  );

  const skipClinical = selectedType === "ml_imaging";
  const activeReports = reports.filter((r) => selectedReportIds.includes(r.id));
  const activeBloodTests = bloodTests.filter((b) => selectedBloodTestIds.includes(b.id));
  const activeImaging = imagingStudies.filter((s) => selectedImagingIds.includes(s.id));

  const contextEstimate = estimateAnalysisContext({
    model: selectedModel,
    analysisType: selectedType,
    reports: skipClinical ? [] : activeReports,
    bloodTests: skipClinical ? [] : activeBloodTests,
    imagingStudies: activeImaging,
    strategyContext,
  });

  const contextFull = contextEstimate.level === "full";
  const noDataSelected =
    (skipClinical ? 0 : selectedReportIds.length + selectedBloodTestIds.length) +
    selectedImagingIds.length === 0;

  async function runAnalysis() {
    if (loadedRun) clearLoadedRun();
    if (contextFull || noDataSelected) return;
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const provider = AI_MODELS[selectedModel]?.provider as AIProvider ?? "gemini";
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          analysisType: selectedType,
          provider,
          model: selectedModel,
          inputDataIds: {
            bloodTestIds: skipClinical ? [] : selectedBloodTestIds,
            reportIds: skipClinical ? [] : selectedReportIds,
            imagingStudyIds: selectedImagingIds,
          },
          strategyContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data.data.result);
      setRunId(data.data.id);
      onComplete?.(data.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  }

  const typeLabel = analysisTypes.find((t) => t.id === selectedType)?.label ?? selectedType;

  return (
    <div className="space-y-5">
      {loadedRun && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-blue-900">Viewing past analysis</p>
            <p className="text-xs text-blue-700 mt-0.5">
              {typeLabel} · {new Date(loadedRun.createdAt).toLocaleString()}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={clearLoadedRun}>
            New analysis
          </Button>
        </div>
      )}

      {/* Configuration */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-blue-600" /> AI Analysis Configuration
          </h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Analysis type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Analysis Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {analysisTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors",
                    selectedType === t.id
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-slate-200 hover:border-blue-300 text-slate-700"
                  )}
                >
                  <div className="text-xs font-semibold">{t.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Model selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableModels.length === 0 ? (
                <option value="">No providers configured</option>
              ) : (
                availableModels.map(([id, m]) => (
                  <option key={id} value={id}>{m.label} ({m.provider})</option>
                ))
              )}
            </select>
          </div>

          {/* Context selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {loadedRun ? "Data included in this analysis" : "Analysis Context"}
            </label>
            <AnalysisContextSelector
              analysisType={selectedType}
              model={selectedModel}
              strategyContext={strategyContext}
              reports={reports}
              bloodTests={bloodTests}
              imagingStudies={imagingStudies}
              selectedReportIds={selectedReportIds}
              selectedBloodTestIds={selectedBloodTestIds}
              selectedImagingIds={selectedImagingIds}
              onToggleReport={(id) => toggleId(id, setSelectedReportIds)}
              onToggleBloodTest={(id) => toggleId(id, setSelectedBloodTestIds)}
              onToggleImaging={(id) => toggleId(id, setSelectedImagingIds)}
              onSelectAllReports={() => setSelectedReportIds(reports.map((r) => r.id))}
              onDeselectAllReports={() => setSelectedReportIds([])}
              onSelectAllBloodTests={() => setSelectedBloodTestIds(bloodTests.map((b) => b.id))}
              onDeselectAllBloodTests={() => setSelectedBloodTestIds([])}
              onSelectAllImaging={() => setSelectedImagingIds(imagingStudies.map((s) => s.id))}
              onDeselectAllImaging={() => setSelectedImagingIds([])}
              readOnly={Boolean(loadedRun)}
            />
          </div>

          {noDataSelected && !loadedRun && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Select at least one report, blood test, or imaging study to include in the analysis.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            onClick={runAnalysis}
            loading={isRunning}
            disabled={availableModels.length === 0 || contextFull || noDataSelected || Boolean(loadedRun)}
            className="w-full"
          >
            <BrainCircuit className="w-4 h-4" />
            {loadedRun
              ? "Viewing past analysis"
              : isRunning
                ? "Running Analysis..."
                : contextFull
                  ? "Context too large — remove items"
                  : "Run Analysis"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && <AnalysisResults result={result} />}
    </div>
  );
}

function AnalysisResults({ result }: { result: AnalysisResult }) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-slate-700 leading-relaxed">{result.summary}</p>
          {result.confidenceScore !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-500">Confidence:</span>
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-32">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${result.confidenceScore * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-700">
                {Math.round((result.confidenceScore ?? 0) * 100)}%
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ML imaging summaries */}
      {result.imagingAnalysis && result.imagingAnalysis.length > 0 && (
        <Card>
          <CardHeader><h4 className="font-semibold text-slate-800">ML Imaging Context</h4></CardHeader>
          <CardContent className="space-y-3">
            {result.imagingAnalysis.map((item) => (
              <ImagingAnalysisResultCard key={item.studyId} item={item} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Progression */}
      {result.progression && <ProgressionCard progression={result.progression} />}

      {/* Cancer signs */}
      {result.cancerSigns && result.cancerSigns.length > 0 && (
        <Card>
          <CardHeader><h4 className="font-semibold text-slate-800">Cancer Signs Identified</h4></CardHeader>
          <CardContent className="space-y-3">
            {result.cancerSigns.map((sign, i) => (
              <div key={i} className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                sign.severity === "severe" ? "bg-red-50 border-red-200" :
                sign.severity === "moderate" ? "bg-orange-50 border-orange-200" : "bg-yellow-50 border-yellow-200"
              )}>
                <AlertTriangle className={cn("w-4 h-4 mt-0.5 flex-shrink-0",
                  sign.severity === "severe" ? "text-red-600" :
                  sign.severity === "moderate" ? "text-orange-600" : "text-yellow-600")} />
                <div className="flex-1">
                  <p className="text-sm text-slate-800">{sign.finding}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={sign.severity === "severe" ? "danger" : sign.severity === "moderate" ? "warning" : "neutral"}>
                      {sign.severity}
                    </Badge>
                    <Badge variant="info">{sign.source}</Badge>
                    <span className="text-xs text-slate-400">{Math.round(sign.confidence * 100)}% confidence</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Next steps */}
      {result.nextSteps && result.nextSteps.length > 0 && (
        <Card>
          <CardHeader><h4 className="font-semibold text-slate-800">Recommended Next Steps</h4></CardHeader>
          <CardContent className="space-y-3">
            {result.nextSteps
              .sort((a, b) => {
                const order = { urgent: 0, high: 1, medium: 2, low: 3 };
                return order[a.priority] - order[b.priority];
              })
              .map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={cn(
                    "mt-0.5 px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0",
                    step.priority === "urgent" ? "bg-red-100 text-red-800" :
                    step.priority === "high" ? "bg-orange-100 text-orange-800" :
                    step.priority === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-700"
                  )}>
                    {step.priority.toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{step.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{step.rationale}</p>
                    {step.timeframe && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {step.timeframe}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Risk factors */}
      {result.riskFactors && result.riskFactors.length > 0 && (
        <Card>
          <CardHeader><h4 className="font-semibold text-slate-800">Risk Factors</h4></CardHeader>
          <CardContent className="space-y-2">
            {result.riskFactors.map((rf, i) => (
              <div key={i} className="flex items-start gap-3">
                <ShieldAlert className={cn("w-4 h-4 mt-0.5 flex-shrink-0",
                  rf.level === "high" ? "text-red-500" : rf.level === "medium" ? "text-orange-500" : "text-yellow-500")} />
                <div>
                  <span className="text-sm font-medium text-slate-800">{rf.factor}</span>
                  <span className={cn("ml-2 text-xs font-medium",
                    rf.level === "high" ? "text-red-600" : rf.level === "medium" ? "text-orange-600" : "text-yellow-600")}>
                    ({rf.level})
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">{rf.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <button
        onClick={() => setShowDisclaimer((v) => !v)}
        className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-600 px-2"
      >
        <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Medical Disclaimer</span>
        {showDisclaimer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {showDisclaimer && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
          {result.disclaimer}
        </div>
      )}
    </div>
  );
}

function ImagingAnalysisResultCard({ item }: { item: ImagingAnalysisSummary }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-800">
          {item.modality}{item.bodyPart ? ` — ${item.bodyPart}` : ""}
        </span>
        {item.studyDate && <span className="text-xs text-slate-500">{item.studyDate}</span>}
        {item.mlModel && (
          <Badge variant="info">{item.mlModel}</Badge>
        )}
        {item.riskScore != null && item.riskScoreLabel && (
          <Badge variant={item.riskLevel === "high" ? "danger" : item.riskLevel === "elevated" ? "warning" : "success"}>
            {item.riskScoreLabel}: {(item.riskScore * 100).toFixed(1)}%
          </Badge>
        )}
      </div>
      {item.highRiskSlices && item.highRiskSlices.length > 0 && (
        <p className="text-xs text-slate-500">
          High-attention slices: {item.highRiskSlices.join(", ")}
        </p>
      )}
      {item.flaggedFindings.map((finding, i) => (
        <MarkdownContent key={i} className="text-xs bg-slate-50 rounded p-2 max-h-40 overflow-y-auto">
          {finding}
        </MarkdownContent>
      ))}
    </div>
  );
}

function ProgressionCard({ progression }: { progression: ProgressionAssessment }) {
  const Icon = progression.trend === "improving" ? TrendingDown :
               progression.trend === "worsening" ? TrendingUp : Minus;
  const colors = {
    improving: "text-green-700 bg-green-50 border-green-200",
    stable: "text-slate-700 bg-slate-50 border-slate-200",
    worsening: "text-red-700 bg-red-50 border-red-200",
    unknown: "text-slate-500 bg-slate-50 border-slate-200",
  };

  return (
    <Card className={cn("border", colors[progression.trend])}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3 mb-2">
          <Icon className="w-5 h-5" />
          <span className="font-semibold capitalize">{progression.trend}</span>
          {progression.comparedPeriod && (
            <span className="text-xs opacity-70">vs {progression.comparedPeriod}</span>
          )}
        </div>
        <p className="text-sm">{progression.description}</p>
        {progression.keyIndicators.length > 0 && (
          <ul className="mt-2 space-y-1">
            {progression.keyIndicators.map((ki, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 opacity-60 flex-shrink-0" />
                {ki}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
