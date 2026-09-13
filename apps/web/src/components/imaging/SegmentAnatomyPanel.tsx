"use client";

import { useEffect, useState } from "react";
import { ScanSearch, RefreshCw, AlertTriangle, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useStudySeries } from "@/components/imaging/StudySeriesProvider";
import { useSegmentOverlay } from "@/components/imaging/SegmentOverlayProvider";
import { formatSeriesOptionLabel } from "@/lib/imaging/series";
import type { SegmentationResult } from "@/lib/imaging/segmentation";

interface Props {
  studyId: string;
  modality: string;
  initialResult: SegmentationResult | null;
  sybilSeriesNumber?: number;
}

type Status = "idle" | "loading_series" | "running" | "done" | "error" | "service_down";

export function SegmentAnatomyPanel({
  studyId,
  modality,
  initialResult,
  sybilSeriesNumber,
}: Props) {
  const studySeries = useStudySeries();
  const segmentCtx = useSegmentOverlay();
  const [status, setStatus] = useState<Status>(initialResult ? "done" : "idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedSeriesNumber, setSelectedSeriesNumber] = useState<number | null>(
    initialResult?.series_number ?? sybilSeriesNumber ?? null,
  );

  useEffect(() => {
    if (modality !== "CT" || !studySeries) return;
    if (studySeries.loading) {
      setStatus((prev) => (prev === "done" || prev === "running" ? prev : "loading_series"));
      return;
    }
    const options = studySeries.seriesOptions;
    const defaultSeries = initialResult?.series_number
      ?? sybilSeriesNumber
      ?? studySeries.recommendedSeriesNumber
      ?? options.find((s) => s.sybil_suitable)?.series_number
      ?? options[0]?.series_number
      ?? null;
    setSelectedSeriesNumber((prev) => prev ?? defaultSeries);
    setStatus((prev) => (prev === "done" || prev === "running" ? prev : "idle"));
  }, [modality, studySeries, initialResult?.series_number, sybilSeriesNumber]);

  const seriesOptions = studySeries?.seriesOptions ?? [];

  async function runSegmentation() {
    if (selectedSeriesNumber == null) {
      setErrorMsg("Select a series to segment");
      setStatus("error");
      return;
    }

    setStatus("running");
    setErrorMsg("");

    try {
      const startRes = await fetch(`/api/imaging/${studyId}/segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesNumber: selectedSeriesNumber, task: "total" }),
      });
      const startData = await startRes.json();

      if (!startRes.ok) {
        setStatus(startData.serviceDown ? "service_down" : "error");
        setErrorMsg(startData.error ?? "Segmentation failed");
        return;
      }

      const jobId = startData.data.jobId as string;

      for (;;) {
        await new Promise((r) => setTimeout(r, 5000));
        const pollRes = await fetch(`/api/imaging/${studyId}/segment?jobId=${jobId}`);
        const pollText = await pollRes.text();
        let pollData: {
          data?: { status?: string; result?: SegmentationResult; error?: string };
          error?: string;
        };
        try {
          pollData = JSON.parse(pollText);
        } catch {
          setStatus("error");
          setErrorMsg("Invalid response from segmentation API");
          return;
        }

        if (!pollRes.ok) {
          setStatus("error");
          setErrorMsg(pollData.data?.error ?? pollData.error ?? "Segmentation failed");
          return;
        }

        const jobStatus = pollData.data?.status as string | undefined;
        if (jobStatus === "completed" && pollData.data?.result) {
          segmentCtx?.applySegmentationResult(pollData.data.result);
          setStatus("done");
          return;
        }
        if (jobStatus === "failed") {
          setStatus("error");
          setErrorMsg(pollData.data?.error ?? "Segmentation failed");
          return;
        }
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
    }
  }

  if (modality !== "CT") {
    return (
      <p className="text-xs text-slate-400 italic">
        Anatomy segmentation is available for CT studies.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
          <ScanSearch className="w-4 h-4 text-teal-600" />
          Anatomy Segmentation
        </h4>
        {status === "done" && (
          <button type="button" onClick={runSegmentation} className="text-slate-400 hover:text-teal-600" title="Re-run">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Segments the <strong>whole selected series</strong> (~104 structures). CPU: expect 10–30 min.
        Re-run after updates if click-to-identify looks misaligned. Click-to-identify uses precomputed masks.
        Install once: <code className="text-[10px] bg-slate-100 px-1 rounded">./setup-segmentation.sh</code> in{" "}
        <code className="text-[10px] bg-slate-100 px-1 rounded">apps/ml-service</code> (separate venv from Sybil).
      </p>

      {seriesOptions.length > 1 && status !== "running" && (
        <select
          value={selectedSeriesNumber ?? ""}
          onChange={(e) => setSelectedSeriesNumber(Number(e.target.value))}
          className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
          disabled={status === "loading_series"}
        >
          {seriesOptions.map((series) => (
            <option key={series.series_number} value={series.series_number}>
              {formatSeriesOptionLabel({
                seriesNumber: series.series_number,
                description: series.description,
                sliceCount: series.slice_count,
                sliceThicknessMm: series.slice_thickness_mm,
              })}
            </option>
          ))}
        </select>
      )}

      {status === "idle" && (
        <Button size="sm" onClick={runSegmentation} className="w-full" disabled={selectedSeriesNumber == null}>
          <ScanSearch className="w-3.5 h-3.5" />
          Segment Structures
        </Button>
      )}

      {status === "running" && (
        <div className="flex items-center gap-2 text-xs text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-3 py-3">
          <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin shrink-0" />
          Running TotalSegmentator…
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={runSegmentation} className="w-full">
            Retry
          </Button>
        </div>
      )}

      {status === "done" && segmentCtx?.segmentOverlay && (
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={segmentCtx.anatomyMode}
              onChange={(e) => segmentCtx.setAnatomyMode(e.target.checked)}
              className="rounded border-slate-300"
            />
            <MousePointer2 className="w-3.5 h-3.5" />
            Click-to-identify mode
          </label>
          {segmentCtx.trackedLabelName ? (
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-teal-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">Following: {segmentCtx.trackedLabelName}</p>
                  <p className="text-[10px] text-teal-800/80 mt-1">
                    Scroll slices to track this structure. Click elsewhere or clear to stop.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => segmentCtx.clearTrackedOrgan()}
                  className="shrink-0 text-[10px] text-teal-700 hover:text-teal-900 underline"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : segmentCtx.clickLabel ? (
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-teal-900 font-medium">
              {segmentCtx.clickLabel}
              <p className="text-[10px] font-normal text-teal-800/80 mt-1">
                Radiological view: patient R is on the left of the image, patient L on the right (R/L markers on viewer).
              </p>
            </div>
          ) : null}
          {segmentCtx.structuresOnSlice.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <p className="text-slate-600 font-medium mb-1">On this slice:</p>
              <ul className="list-disc pl-4 text-slate-700 space-y-0.5">
                {segmentCtx.structuresOnSlice.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-slate-400">
            Click a structure to highlight it across all slices while you scroll.
          </p>
        </div>
      )}
    </div>
  );
}
