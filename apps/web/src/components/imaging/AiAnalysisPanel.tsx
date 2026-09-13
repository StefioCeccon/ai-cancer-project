"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { cn } from "@/lib/utils/cn";
import { useStudyMlOverlay } from "@/components/imaging/StudyMlOverlayProvider";

interface AiAnalyzeMeta {
  sliceCount: number;
  manualCount: number;
  sybilCount: number;
  hasRadiologistReport?: boolean;
  linkedReportCount?: number;
  provider: string;
  model: string;
  runAt: string;
}

interface Props {
  studyId: string;
  modality: string;
  initialFindings: string | null;
  hasSybilResults: boolean;
  instanceCount?: number;
  hasLinkedReport?: boolean;
}

export function AiAnalysisPanel({
  studyId,
  modality,
  initialFindings,
  hasSybilResults,
  instanceCount = 1,
  hasLinkedReport = false,
}: Props) {
  const isXray = modality === "XRAY";
  const isSingleImage = isXray || instanceCount <= 1;
  const mlOverlay = useStudyMlOverlay();
  const sybilAvailable = hasSybilResults || !!mlOverlay?.sybilOverlay;
  const [findings, setFindings] = useState(initialFindings);
  const [meta, setMeta] = useState<AiAnalyzeMeta | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    initialFindings ? "done" : "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [includeManualFlags, setIncludeManualFlags] = useState(true);
  const [includeMlHighlights, setIncludeMlHighlights] = useState(true);

  async function runAnalysis() {
    setStatus("running");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/imaging/${studyId}/ai-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "model_ai",
          includeManualFlags: isSingleImage ? false : includeManualFlags,
          includeMlHighlights: isSingleImage ? false : includeMlHighlights,
          fullImage: isXray,
          provider: "gemini",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "AI analysis failed");
        return;
      }

      setFindings(data.data.findings);
      setMeta(data.data.meta ?? null);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-blue-500" />
          {isXray ? "AI Image Analysis" : "AI Slice Analysis"}
        </h4>
        {status === "done" && (
          <button
            type="button"
            onClick={runAnalysis}
            className="text-slate-400 hover:text-blue-500 transition-colors"
            title="Re-run AI analysis"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          {isXray
            ? "The full X-ray image is sent to Gemini for interpretation (not slice-by-slice)."
            : "Selected slices are sent to Gemini for interpretation. DICOM files leave your machine only as PNG images for this step."}
          {hasLinkedReport && " The linked radiology report is included for comparison."}
        </p>
      </div>

      {!isSingleImage && (
        <div className="space-y-2 text-xs text-slate-600">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeManualFlags}
              onChange={(e) => setIncludeManualFlags(e.target.checked)}
              disabled={status === "running"}
              className="rounded border-slate-300"
            />
            Include manually flagged slices
          </label>
          {modality === "CT" && (
            <label className={cn("flex items-center gap-2", sybilAvailable ? "cursor-pointer" : "opacity-50")}>
              <input
                type="checkbox"
                checked={includeMlHighlights}
                onChange={(e) => setIncludeMlHighlights(e.target.checked)}
                disabled={status === "running" || !sybilAvailable}
                className="rounded border-slate-300"
              />
              Include Sybil high-attention slices
            </label>
          )}
        </div>
      )}

      {isXray && (
        <p className="text-xs text-slate-500">
          TorchXRayVision pathology scoring (Phase 8) is not wired yet — this uses Gemini vision on the full image.
        </p>
      )}

      {status === "idle" && (
        <Button size="sm" onClick={runAnalysis} className="w-full">
          <Sparkles className="w-3.5 h-3.5" />
          {isXray ? "Analyze X-ray" : "Analyze Selected Slices"}
        </Button>
      )}

      {status === "running" && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-3">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="font-medium">{isXray ? "Sending image to Gemini…" : "Sending slices to Gemini…"}</p>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={runAnalysis} className="w-full">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      )}

      {status === "done" && findings && (
        <div className="space-y-2">
          <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 max-h-96 overflow-y-auto">
            <MarkdownContent>{findings}</MarkdownContent>
          </div>
          {meta && (
            <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
              <span>{meta.sliceCount} {isXray ? "image" : "slices"}{meta.sliceCount !== 1 ? (isXray ? "s" : "") : ""}</span>
              {meta.manualCount > 0 && <span>{meta.manualCount} manual</span>}
              {meta.sybilCount > 0 && <span>{meta.sybilCount} Sybil</span>}
              {meta.hasRadiologistReport && <span>with linked report</span>}
              <span>{meta.provider}/{meta.model}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
