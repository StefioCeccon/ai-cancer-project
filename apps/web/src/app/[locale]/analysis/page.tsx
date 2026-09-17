"use client";

import { useState, useEffect, useCallback } from "react";
import { BrainCircuit, Clock, CheckCircle2, XCircle, Trash2, Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useParams } from "next/navigation";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import { ImagingAnalysisSection } from "@/components/analysis/ImagingAnalysisSection";
import { StrategyCard } from "@/components/analysis/StrategyCard";
import type { StrategyRecommendation } from "@/components/analysis/StrategyCard";
import { formatDate } from "@ai-cancer-project/shared";
import type { AIProvider, AnalysisType, AnalysisResult } from "@ai-cancer-project/shared";
import { usePatient } from "@/contexts/PatientContext";
import type {
  ReportContextItem,
  BloodTestContextItem,
  ImagingContextItem,
} from "@/lib/ai/contextEstimate";

interface AnalysisRun {
  id: string;
  patientId: string;
  analysisType: AnalysisType;
  provider: AIProvider;
  model: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  errorMessage?: string | null;
  result?: AnalysisResult;
  inputDataIds?: {
    bloodTestIds?: string[];
    reportIds?: string[];
    imagingStudyIds?: string[];
  };
}

const emptyPatientData = {
  reports: [] as ReportContextItem[],
  bloodTests: [] as BloodTestContextItem[],
  imagingStudies: [] as ImagingContextItem[],
};

export default function AnalysisPage() {
  const { locale } = useParams<{ locale: string }>();
  const { selectedPatientId } = usePatient();
  const [pastRuns, setPastRuns] = useState<AnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [configuredProviders, setConfiguredProviders] = useState<AIProvider[]>([]);
  const [strategy, setStrategy] = useState<StrategyRecommendation | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [appliedStrategy, setAppliedStrategy] = useState<StrategyRecommendation | null>(null);
  const [patientData, setPatientData] = useState(emptyPatientData);

  useEffect(() => {
    fetch("/api/providers").then((r) => r.json()).then((d) => setConfiguredProviders(d.data ?? ["gemini"]));
  }, []);

  const fetchStrategy = useCallback((patientId: string) => {
    setStrategy(null);
    setStrategyLoading(true);
    fetch("/api/analysis/strategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId }),
    })
      .then((r) => r.json())
      .then((d) => setStrategy(d.data ?? null))
      .catch(() => setStrategy(null))
      .finally(() => setStrategyLoading(false));
  }, []);

  useEffect(() => {
    setSelectedRun(null);

    if (!selectedPatientId) {
      setPastRuns([]);
      setPatientData(emptyPatientData);
      setStrategy(null);
      setAppliedStrategy(null);
      return;
    }

    // Load past analyses
    fetch(`/api/analysis?patientId=${selectedPatientId}`)
      .then((r) => r.json())
      .then((d) => setPastRuns(d.data ?? []));

    // Load patient data for analysis context
    Promise.all([
      fetch(`/api/blood-tests?patientId=${selectedPatientId}`).then((r) => r.json()),
      fetch(`/api/reports?patientId=${selectedPatientId}`).then((r) => r.json()),
      fetch(`/api/imaging?patientId=${selectedPatientId}`).then((r) => r.json()),
    ]).then(([blood, reports, imaging]) => {
      setPatientData({
        bloodTests: (blood.data ?? []).map((t: BloodTestContextItem) => ({
          id: t.id,
          testDate: t.testDate,
          labName: t.labName,
          markers: t.markers ?? [],
        })),
        reports: (reports.data ?? []).map((r: ReportContextItem) => ({
          id: r.id,
          title: r.title,
          reportType: r.reportType,
          reportDate: r.reportDate,
          author: r.author,
          institution: r.institution,
          rawText: r.rawText,
          aiSummary: r.aiSummary,
        })),
        imagingStudies: (imaging.data ?? []).map((s: ImagingContextItem) => ({
          id: s.id,
          modality: s.modality,
          bodyPart: s.bodyPart,
          studyDate: s.studyDate,
          description: s.description,
          radiologistReport: s.radiologistReport,
          aiFindings: s.aiFindings,
          mlModelResults: s.mlModelResults,
        })),
      });
    });

    fetchStrategy(selectedPatientId);
  }, [selectedPatientId, fetchStrategy]);

  const loadPastRun = useCallback(async (runId: string) => {
    setLoadingRunId(runId);
    try {
      const res = await fetch(`/api/analysis/${runId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load analysis");
      setSelectedRun(data.data);
    } catch {
      // Keep list selection visible even if fetch fails
      setSelectedRun(pastRuns.find((r) => r.id === runId) ?? null);
    } finally {
      setLoadingRunId(null);
    }
  }, [pastRuns]);

  const deletePastRun = useCallback(async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this analysis? This cannot be undone.")) return;

    const res = await fetch(`/api/analysis/${runId}`, { method: "DELETE" });
    if (!res.ok) return;

    setPastRuns((runs) => runs.filter((r) => r.id !== runId));
    if (selectedRun?.id === runId) setSelectedRun(null);
  }, [selectedRun?.id]);

  const statusIcon = {
    pending: <Clock className="w-3.5 h-3.5 text-slate-400" />,
    running: <div className="w-3.5 h-3.5 border border-blue-500 border-t-transparent rounded-full animate-spin" />,
    completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
    failed: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  };

  const typeLabels: Record<AnalysisType, string> = {
    comprehensive: "Comprehensive",
    cancer_progression: "Progression",
    biomarker_trend: "Biomarkers",
    imaging_findings: "Imaging",
    ml_imaging: "ML Imaging",
    treatment_response: "Treatment",
    risk_assessment: "Risk",
    next_steps: "Next Steps",
    mdt_consultation: "MDT Consultation",
  };

  return (
    <AppShell title="AI Analysis">
      {/* MDT promo banner */}
      <Link
        href={`/${locale}/mdt`}
        className="flex items-center gap-3 mb-5 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl hover:border-blue-200 transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
          <Users className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">MDT Consultation</p>
          <p className="text-xs text-slate-500 truncate">
            Run a full multi-disciplinary team consultation — 6 AI specialists in parallel, then an oncologist synthesis
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: past runs — after main panel on mobile */}
        <div className="space-y-4 order-2 lg:order-1">
          {!selectedPatientId && (
            <p className="text-sm text-slate-500">
              Select a patient from the header to run an AI analysis.
            </p>
          )}

          {selectedPatientId && pastRuns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Previous Analyses</p>
              <div className="space-y-2 max-h-64 lg:max-h-none overflow-y-auto">
                {pastRuns.map((run) => (
                  <div
                    key={run.id}
                    className={`relative rounded-lg border transition-colors ${
                      selectedRun?.id === run.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-blue-300 bg-white"
                    }`}
                  >
                    <button
                      onClick={() => loadPastRun(run.id)}
                      disabled={loadingRunId === run.id}
                      className="w-full text-left p-3 pr-10"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">
                          {typeLabels[run.analysisType]}
                        </span>
                        {loadingRunId === run.id ? (
                          <div className="w-3.5 h-3.5 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          statusIcon[run.status]
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(run.createdAt)} · {run.model}</p>
                      {run.result?.summary && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{run.result.summary}</p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deletePastRun(run.id, e)}
                      className="absolute top-2 right-2 p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete analysis"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: strategy + analysis panel — first on mobile */}
        <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
          {selectedPatientId && (
            <StrategyCard
              strategy={strategy}
              loading={strategyLoading}
              onApply={(s) => setAppliedStrategy(s)}
              onRefresh={() => fetchStrategy(selectedPatientId)}
            />
          )}
          {selectedPatientId && (
            <ImagingAnalysisSection patientId={selectedPatientId} locale={locale ?? "en"} />
          )}
          {selectedPatientId ? (
            <AnalysisPanel
              patientId={selectedPatientId}
              patientData={patientData}
              configuredProviders={configuredProviders.length > 0 ? configuredProviders : ["gemini"]}
              initialAnalysisType={appliedStrategy?.recommendedAnalysisType}
              strategyContext={appliedStrategy?.promptContext}
              loadedRun={selectedRun}
              loadedResult={selectedRun?.result ?? null}
              onClearLoadedRun={() => setSelectedRun(null)}
              onComplete={() => {
                fetch(`/api/analysis?patientId=${selectedPatientId}`)
                  .then((r) => r.json())
                  .then((d) => setPastRuns(d.data ?? []));
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-300">
              <div className="text-center">
                <BrainCircuit className="w-16 h-16 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select a patient to run an AI analysis</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
