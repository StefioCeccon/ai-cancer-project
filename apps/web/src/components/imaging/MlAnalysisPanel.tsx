"use client";

import { useState, useEffect, useRef } from "react";
import {
  Cpu, Play, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, ShieldCheck, TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { formatSeriesOptionLabel } from "@/lib/imaging/series";
import { useStudySeries } from "@/components/imaging/StudySeriesProvider";
import { useStudyMlOverlay } from "@/components/imaging/StudyMlOverlayProvider";

interface RiskScores {
  "1yr": number;
  "2yr": number;
  "3yr": number;
  "4yr": number;
  "5yr": number;
  "6yr": number;
}

export interface SybilResult {
  model: string;
  risk_scores: RiskScores;
  risk_level: "low" | "elevated" | "high";
  high_risk_instances: number[];
  slice_count: number;
  processing_time_seconds: number;
  series_number?: number;
  slice_thickness_mm?: number;
  excluded_slice_count?: number;
  runAt?: string;
}

interface Props {
  studyId: string;
  modality: string;
  initialResults: SybilResult | null;
}

type Status = "idle" | "loading_series" | "running" | "done" | "error" | "service_down";

const riskColors: Record<string, string> = {
  low: "text-green-700 bg-green-50 border-green-200",
  elevated: "text-orange-700 bg-orange-50 border-orange-200",
  high: "text-red-700 bg-red-50 border-red-200",
};

const riskLabels: Record<string, string> = {
  low: "Low Risk",
  elevated: "Elevated Risk",
  high: "High Risk",
};

function riskBarColor(score: number): string {
  if (score < 0.03) return "bg-green-500";
  if (score < 0.10) return "bg-orange-400";
  return "bg-red-500";
}

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function MlAnalysisPanel({ studyId, modality, initialResults }: Props) {
  const studySeries = useStudySeries();
  const mlOverlayCtx = useStudyMlOverlay();
  const [status, setStatus] = useState<Status>(initialResults ? "done" : "idle");
  const [result, setResult] = useState<SybilResult | null>(initialResults);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const [selectedSeriesNumber, setSelectedSeriesNumber] = useState<number | null>(
    initialResults?.series_number ?? null,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "running") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  useEffect(() => {
    if (modality !== "CT" || !studySeries) return;

    if (studySeries.loading) {
      setStatus((prev) => (prev === "done" || prev === "running" ? prev : "loading_series"));
      return;
    }

    if (studySeries.error) {
      if (studySeries.serviceDown) {
        setStatus("service_down");
        setErrorMsg(studySeries.error);
      } else {
        setStatus("error");
        setErrorMsg(studySeries.error);
      }
      return;
    }

    const options = studySeries.seriesOptions;
    const defaultSeries = initialResults?.series_number
      ?? studySeries.recommendedSeriesNumber
      ?? options.find((s) => s.sybil_suitable)?.series_number
      ?? options[0]?.series_number
      ?? null;

    setSelectedSeriesNumber((prev) => prev ?? defaultSeries);

    setStatus((prev) => (prev === "done" || prev === "running" ? prev : "idle"));
  }, [modality, studySeries, initialResults?.series_number]);

  const seriesOptions = studySeries?.seriesOptions ?? [];

  async function runAnalysis() {
    if (selectedSeriesNumber == null) {
      setErrorMsg("Select a series to analyze");
      setStatus("error");
      return;
    }

    const selected = seriesOptions.find((s) => s.series_number === selectedSeriesNumber);
    if (selected && !selected.sybil_suitable) {
      setErrorMsg(selected.unsuitability_reason ?? "This series is not suitable for Sybil analysis");
      setStatus("error");
      return;
    }

    setStatus("running");
    setErrorMsg("");
    try {
      const startRes = await fetch(`/api/imaging/${studyId}/ml-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesNumber: selectedSeriesNumber }),
      });
      const startData = await startRes.json();

      if (!startRes.ok) {
        if (startData.serviceDown) {
          setStatus("service_down");
          setErrorMsg(startData.error);
        } else {
          setStatus("error");
          setErrorMsg(startData.error ?? "Analysis failed");
        }
        return;
      }

      const jobId = startData.data.jobId as string;

      // Poll until complete — Sybil on CPU can take 5–12 min
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await fetch(`/api/imaging/${studyId}/ml-analyze?jobId=${jobId}`);
        const pollData = await pollRes.json();

        if (!pollRes.ok) {
          setStatus("error");
          setErrorMsg(pollData.data?.error ?? pollData.error ?? "Analysis failed");
          return;
        }

        const status = pollData.data.status as string;
        if (status === "completed" && pollData.data.result) {
          setResult(pollData.data.result);
          mlOverlayCtx?.applySybilResult(pollData.data.result);
          setStatus("done");
          return;
        }

        if (status === "failed") {
          setStatus("error");
          setErrorMsg(pollData.data.error ?? "Analysis failed");
          return;
        }
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
    }
  }

  const isCT = modality === "CT";
  const selectedSeries = seriesOptions.find((s) => s.series_number === selectedSeriesNumber);
  const suitableSeries = seriesOptions.filter((s) => s.sybil_suitable);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
          <Cpu className="w-4 h-4 text-purple-500" />
          ML Analysis
        </h4>
        {status === "done" && (
          <button
            onClick={runAnalysis}
            className="text-slate-400 hover:text-purple-500 transition-colors"
            title="Re-run analysis"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!isCT && (
        <div className="text-xs text-slate-400 italic">
          Sybil supports CT scans only. X-ray / MRI models coming in Phase 8.
        </div>
      )}

      {isCT && seriesOptions.length > 1 && status !== "running" && (
        <div className="space-y-1.5">
          <label htmlFor={`ml-series-${studyId}`} className="text-xs text-slate-500">
            Series to analyze
          </label>
          <select
            id={`ml-series-${studyId}`}
            value={selectedSeriesNumber ?? ""}
            onChange={(e) => setSelectedSeriesNumber(Number(e.target.value))}
            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-800"
            disabled={status === "loading_series"}
          >
            {seriesOptions.map((series) => (
              <option key={series.series_number} value={series.series_number}>
                {formatSeriesOptionLabel({
                  seriesNumber: series.series_number,
                  description: series.description,
                  sliceCount: series.slice_count,
                  sliceThicknessMm: series.slice_thickness_mm,
                  sybilSuitable: series.sybil_suitable,
                  includeSybilNote: true,
                })}
              </option>
            ))}
          </select>
          {selectedSeries && !selectedSeries.sybil_suitable && (
            <p className="text-[11px] text-amber-700">
              {selectedSeries.unsuitability_reason ?? "This series cannot be used for Sybil."}
            </p>
          )}
          {suitableSeries.length > 1 && selectedSeries?.sybil_suitable && (
            <p className="text-[11px] text-slate-400">
              Sybil analyzes one series at a time. Other series remain available in the viewer.
            </p>
          )}
        </div>
      )}

      {isCT && status === "loading_series" && (
        <div className="text-xs text-slate-400">Loading series metadata…</div>
      )}

      {isCT && (status === "idle" || status === "loading_series") && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            Data stays on your machine — no external servers
          </div>
          <p className="text-xs text-slate-500">
            Sybil predicts 1–6 year lung cancer risk from a single CT series.
            Estimated time: <span className="font-medium">5–12 min</span> on your Mac.
          </p>
          <Button
            size="sm"
            onClick={runAnalysis}
            className="w-full"
            disabled={status === "loading_series" || selectedSeriesNumber == null || selectedSeries?.sybil_suitable === false}
          >
            <Play className="w-3.5 h-3.5" />
            Run Sybil Analysis
          </Button>
        </div>
      )}

      {status === "running" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-3">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="font-medium">
                Running Sybil on series {selectedSeriesNumber}…
              </p>
              <p className="text-blue-500 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {formatElapsed(elapsed)} elapsed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            Running locally — no data sent externally
          </div>
          <p className="text-xs text-slate-400">This may take several minutes. You can keep using the app.</p>
        </div>
      )}

      {status === "service_down" && (
        <div className="space-y-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ML service not running
            </div>
            <p>Start it in a terminal:</p>
            <code className="block bg-amber-100 rounded px-2 py-1 font-mono text-[11px]">
              cd apps/ml-service && ./start.sh
            </code>
            <p className="text-amber-600">Then try again.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={runAnalysis} className="w-full">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {errorMsg}
          </div>
          <Button size="sm" variant="ghost" onClick={runAnalysis} className="w-full">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      )}

      {status === "done" && result && (
        <div className="space-y-3">
          <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold", riskColors[result.risk_level])}>
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>{riskLabels[result.risk_level]}</span>
            <span className="ml-auto text-xs font-normal opacity-70">
              6yr: {(result.risk_scores["6yr"] * 100).toFixed(1)}%
            </span>
          </div>

          <div>
            <button
              onClick={() => setShowScores((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium mb-2"
            >
              {showScores ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Year-by-year risk scores
            </button>
            {showScores && (
              <div className="space-y-1.5">
                {(["1yr", "2yr", "3yr", "4yr", "5yr", "6yr"] as const).map((yr) => {
                  const pct = result.risk_scores[yr] * 100;
                  return (
                    <div key={yr} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-6 shrink-0">{yr}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", riskBarColor(result.risk_scores[yr]))}
                          style={{ width: `${Math.min(pct * 4, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 w-10 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
                <p className="text-[10px] text-slate-400 mt-1">Bar scaled to 25% max for readability.</p>
              </div>
            )}
          </div>

          {result.high_risk_instances.length > 0 ? (
            <div className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-purple-800">
                  {result.high_risk_instances.length} high-attention slices identified
                </p>
                <p className="text-[10px] text-purple-600 mt-0.5">
                  Marked in the viewer on Series {result.series_number}
                  · use Highlight button, Heatmap toggle, or purple dots on the slider
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Re-run analysis to refresh slice highlights on the viewer.
            </p>
          )}

          <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
            {result.series_number != null && <span>Series {result.series_number}</span>}
            <span>{result.slice_count} slices analysed</span>
            {result.slice_thickness_mm != null && <span>{result.slice_thickness_mm} mm</span>}
            <span>{result.processing_time_seconds}s</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" /> local</span>
          </div>
        </div>
      )}
    </div>
  );
}
