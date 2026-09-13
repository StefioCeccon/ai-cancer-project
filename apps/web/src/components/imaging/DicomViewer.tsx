"use client";

import { useEffect, useRef, useState, useMemo, type MouseEvent } from "react";
import { ZoomIn, ZoomOut, RotateCw, Contrast, ChevronLeft, ChevronRight, AlertCircle, SkipForward, Pin, Layers } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ImagingInstanceRef, ImagingSeriesGroup } from "@/lib/imaging/series";
import { useStudySeries } from "@/components/imaging/StudySeriesProvider";
import { useStudyMlOverlay } from "@/components/imaging/StudyMlOverlayProvider";
import { useSegmentOverlay } from "@/components/imaging/SegmentOverlayProvider";
import { overlayRiskBadgeColors, resolveHeatmapUrl, resolveHighRiskStackIndices } from "@/lib/imaging/sybil";
import {
  clearMaskCache,
  drawLabelHighlight,
  labelsForSlice,
  labelName,
  loadMaskEntry,
  mapViewportClickToImageCoords,
  resolveMaskUrl,
  sampleMaskLabelFromEntry,
  sliceHasLabel,
} from "@/lib/imaging/segmentation";
import { TOTAL_SEGMENTATOR_LABELS } from "@/lib/imaging/totalSegmentatorLabels";

interface DicomViewerProps {
  studyId: string;
  seriesGroups: ImagingSeriesGroup[];
  className?: string;
}

// Singleton init — run once across the page lifetime
let initPromise: Promise<void> | null = null;
async function ensureInit() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const [cs, loader] = await Promise.all([
      import("@cornerstonejs/core"),
      import("@cornerstonejs/dicom-image-loader"),
    ]);
    await cs.init();
    (loader as unknown as { init: (o: object) => void }).init({ maxWebWorkers: 1 });
  })();
  return initPromise;
}

export function DicomViewer({ studyId, seriesGroups, className }: DicomViewerProps) {
  const studySeries = useStudySeries();
  const mlOverlayCtx = useStudyMlOverlay();
  const segmentCtx = useSegmentOverlay();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const highlightCanvasRef = useRef<HTMLCanvasElement>(null);
  const [internalSeriesNumber, setInternalSeriesNumber] = useState(
    () => mlOverlayCtx?.viewerSeriesNumber ?? seriesGroups[0]?.seriesNumber ?? 0,
  );
  const selectedSeriesNumber = mlOverlayCtx?.viewerSeriesNumber ?? internalSeriesNumber;
  const setSelectedSeriesNumber = mlOverlayCtx?.setViewerSeriesNumber ?? setInternalSeriesNumber;
  const activeGroup = seriesGroups.find((g) => g.seriesNumber === selectedSeriesNumber) ?? seriesGroups[0];
  const filePaths = activeGroup?.filePaths ?? [];
  const activeInstances = activeGroup?.instances ?? [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [total, setTotal] = useState(filePaths.length);
  const [isLoading, setIsLoading] = useState(filePaths.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [flagOverrides, setFlagOverrides] = useState<Map<string, boolean>>(new Map());
  const [flagSaving, setFlagSaving] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [anatomyClickPin, setAnatomyClickPin] = useState<{ x: number; y: number; label: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewportRef = useRef<any>(null);
  const currentIndexRef = useRef(0);
  const engineId = `engine-${studyId}`;
  const viewportId = `vp-${studyId}`;

  const sybilOverlay = mlOverlayCtx?.sybilOverlay;
  const activeSybilOverlay = useMemo(() => {
    if (!sybilOverlay || sybilOverlay.seriesNumber !== Number(selectedSeriesNumber)) return null;
    return sybilOverlay;
  }, [sybilOverlay, selectedSeriesNumber]);

  const highRiskStackIndices = useMemo(
    () => (activeSybilOverlay ? resolveHighRiskStackIndices(activeSybilOverlay, filePaths) : []),
    [activeSybilOverlay, filePaths],
  );

  const highRiskSet = useMemo(
    () => new Set(highRiskStackIndices),
    [highRiskStackIndices],
  );
  const isCurrentHighRisk = highRiskSet.has(currentIndex);

  function isInstanceFlagged(inst: ImagingInstanceRef | undefined): boolean {
    if (!inst) return false;
    if (flagOverrides.has(inst.id)) return flagOverrides.get(inst.id)!;
    return inst.flaggedForAI;
  }

  const flaggedStackIndices = useMemo(
    () => activeInstances.reduce<number[]>((acc, inst, index) => {
      if (isInstanceFlagged(inst)) acc.push(index);
      return acc;
    }, []),
    [activeInstances, flagOverrides],
  );

  const flaggedSet = useMemo(() => new Set(flaggedStackIndices), [flaggedStackIndices]);
  const currentInstance = activeInstances[currentIndex];
  const isCurrentFlagged = isInstanceFlagged(currentInstance);

  const hasHeatmaps = useMemo(
    () => activeSybilOverlay != null && Object.keys(activeSybilOverlay.heatmapByFileName).length > 0,
    [activeSybilOverlay],
  );

  const currentHeatmapUrl = useMemo(() => {
    if (!activeSybilOverlay || !filePaths[currentIndex]) return null;
    return resolveHeatmapUrl(activeSybilOverlay, filePaths[currentIndex]);
  }, [activeSybilOverlay, filePaths, currentIndex]);

  const activeSegmentOverlay = useMemo(() => {
    if (!segmentCtx?.segmentOverlay || segmentCtx.segmentOverlay.seriesNumber !== Number(selectedSeriesNumber)) {
      return null;
    }
    const overlay = segmentCtx.segmentOverlay;
    if (Object.keys(overlay.labels).length > 0) return overlay;
    return { ...overlay, labels: TOTAL_SEGMENTATOR_LABELS };
  }, [segmentCtx?.segmentOverlay, selectedSeriesNumber]);

  const setStructuresOnSlice = segmentCtx?.setStructuresOnSlice;
  const trackedLabelId = segmentCtx?.trackedLabelId ?? null;
  const trackedLabelName = segmentCtx?.trackedLabelName ?? null;
  const currentSlicePath = filePaths[currentIndex] ?? "";

  const trackedOnCurrentSlice = useMemo(() => {
    if (!activeSegmentOverlay || trackedLabelId == null || !currentSlicePath) return false;
    return sliceHasLabel(activeSegmentOverlay, currentSlicePath, trackedLabelId);
  }, [activeSegmentOverlay, trackedLabelId, currentSlicePath]);

  useEffect(() => {
    if (!setStructuresOnSlice) return;

    const next =
      !currentSlicePath || !activeSegmentOverlay
        ? []
        : labelsForSlice(activeSegmentOverlay, currentSlicePath);

    setStructuresOnSlice((prev) => {
      if (prev.length === next.length && prev.every((value, index) => value === next[index])) {
        return prev;
      }
      return next;
    });
  }, [setStructuresOnSlice, activeSegmentOverlay, currentSlicePath]);

  useEffect(() => {
    setAnatomyClickPin(null);
  }, [currentIndex]);

  useEffect(() => {
    segmentCtx?.clearTrackedOrgan();
    setAnatomyClickPin(null);
    const canvas = highlightCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [selectedSeriesNumber, segmentCtx?.clearTrackedOrgan]);

  useEffect(() => {
    clearMaskCache();
  }, [segmentCtx?.segmentOverlay]);

  useEffect(() => {
    const canvas = highlightCanvasRef.current;
    const container = viewportContainerRef.current;
    const element = containerRef.current;
    const vp = viewportRef.current;
    if (!canvas || !container || !element || !vp || trackedLabelId == null || !activeSegmentOverlay) return;

    const maskUrl = resolveMaskUrl(activeSegmentOverlay, filePaths[currentIndex] ?? "");
    if (!maskUrl) return;

    let cancelled = false;
    let entryPromise: ReturnType<typeof loadMaskEntry> | null = null;

    const redraw = () => {
      if (!entryPromise) entryPromise = loadMaskEntry(maskUrl);
      entryPromise.then((entry) => {
        if (cancelled) return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        drawLabelHighlight(canvas, vp, entry, trackedLabelId);
      }).catch(() => {});
    };

    redraw();

    let removeListeners: (() => void) | undefined;
    import("@cornerstonejs/core").then((cs) => {
      if (cancelled) return;
      const rendered = cs.Enums.Events.IMAGE_RENDERED;
      const camera = cs.Enums.Events.CAMERA_MODIFIED;
      element.addEventListener(rendered, redraw);
      element.addEventListener(camera, redraw);
      removeListeners = () => {
        element.removeEventListener(rendered, redraw);
        element.removeEventListener(camera, redraw);
      };
    });

    return () => {
      cancelled = true;
      removeListeners?.();
    };
  }, [trackedLabelId, activeSegmentOverlay, filePaths, currentIndex, isLoading]);

  async function handleAnatomyClick(event: MouseEvent<HTMLDivElement>) {
    if (!segmentCtx?.anatomyMode || !activeSegmentOverlay) return;

    const maskUrl = resolveMaskUrl(activeSegmentOverlay, filePaths[currentIndex] ?? "");
    const element = containerRef.current;
    const vp = viewportRef.current;
    if (!maskUrl || !element || !vp) {
      segmentCtx.setClickLabel("No segmentation mask for this slice");
      setAnatomyClickPin(null);
      segmentCtx.clearTrackedOrgan();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const imageCoords = mapViewportClickToImageCoords(vp, element, event.clientX, event.clientY);

    if (!imageCoords) {
      segmentCtx.setClickLabel("Click inside the image area");
      setAnatomyClickPin(null);
      segmentCtx.clearTrackedOrgan();
      return;
    }

    try {
      const entry = await loadMaskEntry(maskUrl);
      const labelId = sampleMaskLabelFromEntry(entry, imageCoords.col, imageCoords.row);
      const label = labelName(activeSegmentOverlay.labels, labelId);
      if (labelId > 0) {
        segmentCtx.trackOrgan(labelId, label);
        setAnatomyClickPin({ x: clickX, y: clickY, label });
      } else {
        segmentCtx.clearTrackedOrgan();
        segmentCtx.setClickLabel("Background / no structure");
        setAnatomyClickPin(null);
      }
    } catch {
      segmentCtx.setClickLabel("Could not read segmentation mask");
      setAnatomyClickPin(null);
      segmentCtx.clearTrackedOrgan();
    }
  }

  async function toggleFlagForCurrentSlice() {
    const inst = currentInstance;
    if (!inst || flagSaving) return;

    const next = !isInstanceFlagged(inst);
    setFlagOverrides((prev) => new Map(prev).set(inst.id, next));
    setFlagSaving(true);

    try {
      const res = await fetch(`/api/imaging/instances/${inst.id}/flag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged: next }),
      });
      if (!res.ok) throw new Error("Failed to update flag");
    } catch {
      setFlagOverrides((prev) => {
        const nextMap = new Map(prev);
        nextMap.delete(inst.id);
        return nextMap;
      });
    } finally {
      setFlagSaving(false);
    }
  }

  useEffect(() => {
    if (mlOverlayCtx?.viewerSeriesNumber == null) {
      setInternalSeriesNumber(seriesGroups[0]?.seriesNumber ?? 0);
    }
  }, [seriesGroups, mlOverlayCtx?.viewerSeriesNumber]);

  useEffect(() => {
    setCurrentIndex(0);
    currentIndexRef.current = 0;
  }, [selectedSeriesNumber]);

  useEffect(() => {
    if (!containerRef.current || filePaths.length === 0) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        await ensureInit();
        if (cancelled) return;

        const cs = await import("@cornerstonejs/core");
        const { RenderingEngine, Enums } = cs;

        // Destroy any existing engine with this id
        try { cs.getRenderingEngine(engineId)?.destroy(); } catch {}

        const engine = new RenderingEngine(engineId);

        engine.enableElement({
          viewportId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: (Enums as any).ViewportType?.STACK ?? "stack",
          element: containerRef.current!,
          defaultOptions: { background: [0, 0, 0] },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viewport = engine.getViewport(viewportId) as any;
        viewportRef.current = viewport;

        const origin = window.location.origin;
        const imageIds = filePaths.map((p) => `wadouri:${origin}${p}`);
        setTotal(imageIds.length);

        await viewport.setStack(imageIds, 0);
        viewport.render();
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.error("DicomViewer error:", e);
          setError(e instanceof Error ? e.message : "Failed to load DICOM images");
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      import("@cornerstonejs/core").then((cs) => {
        try { cs.getRenderingEngine(engineId)?.destroy(); } catch {}
      });
    };
  // only re-run if the study changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, selectedSeriesNumber, filePaths.join(",")]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      goToSlice(currentIndexRef.current + (e.deltaY > 0 ? 1 : -1));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  // goToSlice is stable — no deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goToSlice(index: number) {
    const vp = viewportRef.current;
    if (!vp || total === 0) return;

    // Walk in the requested direction, skipping frames without pixel data
    const direction = index >= currentIndex ? 1 : -1;
    let i = Math.max(0, Math.min(total - 1, index));
    let attempts = 0;

    while (attempts < total) {
      try {
        await vp.setImageIdIndex(i);
        vp.render();
        currentIndexRef.current = i;
        setCurrentIndex(i);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : "";
        if (msg.includes("pixel data") || msg.includes("missing")) {
          // Skip this frame in the travel direction
          i = Math.max(0, Math.min(total - 1, i + direction));
          attempts++;
        } else {
          return; // unexpected error — stop silently
        }
      }
    }
  }

  async function resetView() {
    const vp = viewportRef.current;
    if (!vp) return;
    try {
      vp.resetCamera();
      vp.resetProperties?.();
      vp.render();
    } catch {}
  }

  async function adjustWL(deltaW: number, deltaL: number) {
    const vp = viewportRef.current;
    if (!vp) return;
    try {
      const props = vp.getProperties?.() ?? {};
      const voi = props.voiRange ?? { lower: -500, upper: 500 };
      const ww = voi.upper - voi.lower + deltaW;
      const wl = (voi.upper + voi.lower) / 2 + deltaL;
      vp.setProperties?.({ voiRange: { lower: wl - ww / 2, upper: wl + ww / 2 } });
      vp.render();
    } catch {}
  }

  async function goToNextHighRisk() {
    if (highRiskSet.size === 0) return;
    const sorted = [...highRiskSet].sort((a, b) => a - b);
    const next = sorted.find((i) => i > currentIndex) ?? sorted[0];
    await goToSlice(next);
  }

  if (seriesGroups.length === 0 || filePaths.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-black rounded-lg", className)} style={{ minHeight: 400 }}>
        <p className="text-slate-500 text-sm">No images loaded</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {seriesGroups.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor={`series-${studyId}`} className="text-xs text-slate-500 shrink-0">
            Series
          </label>
          <select
            id={`series-${studyId}`}
            value={selectedSeriesNumber}
            onChange={(e) => setSelectedSeriesNumber(Number(e.target.value))}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-800"
          >
            {seriesGroups.map((group) => (
              <option key={group.seriesNumber} value={group.seriesNumber}>
                {studySeries?.getSeriesLabel(group.seriesNumber, group.label) ?? group.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {sybilOverlay && !activeSybilOverlay && (
        <div className="flex items-center justify-between gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Sybil analyzed Series {sybilOverlay.seriesNumber}. Switch series to see highlights.
          </div>
          <button
            type="button"
            onClick={() => setSelectedSeriesNumber(sybilOverlay.seriesNumber)}
            className="shrink-0 font-medium text-amber-900 underline"
          >
            Go to Series {sybilOverlay.seriesNumber}
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-slate-800 rounded-lg flex-wrap">
        <button onClick={resetView} title="Reset" className="px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-1">
          <RotateCw className="w-3.5 h-3.5" /> Reset
        </button>
        <button onClick={() => adjustWL(100, 0)} title="Widen window" className="px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-1">
          <Contrast className="w-3.5 h-3.5" /> W+
        </button>
        <button onClick={() => adjustWL(-100, 0)} title="Narrow window" className="px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-1">
          <Contrast className="w-3.5 h-3.5" /> W-
        </button>
        <button onClick={() => adjustWL(0, 50)} title="Brighten" className="px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-1">
          <ZoomIn className="w-3.5 h-3.5" /> L+
        </button>
        <button onClick={() => adjustWL(0, -50)} title="Darken" className="px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-1">
          <ZoomOut className="w-3.5 h-3.5" /> L-
        </button>
        {activeSybilOverlay && highRiskSet.size > 0 && (
          <button
            onClick={goToNextHighRisk}
            title="Jump to next high-attention slice"
            className="px-2 py-1.5 rounded text-xs text-purple-200 hover:bg-purple-900/40 flex items-center gap-1"
          >
            <SkipForward className="w-3.5 h-3.5" /> Highlight
          </button>
        )}
        {activeSybilOverlay && hasHeatmaps && (
          <button
            onClick={() => setShowHeatmap((v) => !v)}
            title={showHeatmap ? "Hide Sybil attention heatmap" : "Show Sybil attention heatmap"}
            className={cn(
              "px-2 py-1.5 rounded text-xs flex items-center gap-1",
              showHeatmap
                ? "text-purple-200 bg-purple-900/40 hover:bg-purple-900/60"
                : "text-slate-300 hover:bg-slate-700",
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Heatmap
          </button>
        )}
        {currentInstance && (
          <button
            onClick={toggleFlagForCurrentSlice}
            disabled={flagSaving}
            title={isCurrentFlagged ? "Remove AI flag from this slice" : "Flag this slice for AI analysis"}
            className={cn(
              "px-2 py-1.5 rounded text-xs flex items-center gap-1",
              isCurrentFlagged
                ? "text-amber-200 bg-amber-900/40 hover:bg-amber-900/60"
                : "text-slate-300 hover:bg-slate-700",
              flagSaving && "opacity-50 cursor-not-allowed",
            )}
          >
            <Pin className={cn("w-3.5 h-3.5", isCurrentFlagged && "fill-current")} />
            {isCurrentFlagged ? "Flagged" : "Flag for AI"}
          </button>
        )}
        <div className="flex-1" />
        <span className={cn(
          "text-[11px] px-2 font-mono tabular-nums",
          isCurrentHighRisk ? "text-purple-300" : isCurrentFlagged ? "text-amber-300" : "text-slate-400",
        )}>
          {currentInstance ? (
            <>Image {currentIndex + 1} · inst {currentInstance.instanceNumber}</>
          ) : (
            <>Image {currentIndex + 1}{total > 1 ? ` / ${total}` : ""}</>
          )}
          {isCurrentHighRisk && " · Sybil"}
          {!isCurrentHighRisk && isCurrentFlagged && " · flagged"}
        </span>
      </div>

      {/* Viewport container — Cornerstone renders into this div */}
      <div
        ref={viewportContainerRef}
        className={cn(
          "relative rounded-lg overflow-hidden",
          isCurrentHighRisk && "ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900",
          !isCurrentHighRisk && isCurrentFlagged && "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900",
          segmentCtx?.anatomyMode && activeSegmentOverlay && "ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-900",
        )}
        style={{ width: "100%", height: 520, background: "#000" }}
      >
        {currentInstance && (
          <div className="absolute top-3 left-3 z-20 px-2 py-1 rounded-md text-[11px] font-mono tabular-nums text-slate-100 bg-black/70 border border-slate-700/80 pointer-events-none">
            Image {currentIndex + 1}
            <span className="text-slate-400"> · inst {currentInstance.instanceNumber}</span>
            {total > 1 && <span className="text-slate-500"> · {currentIndex + 1}/{total}</span>}
          </div>
        )}
        {/* Radiological laterality: patient R on viewer left, patient L on viewer right (axial CT). */}
        <div className="absolute bottom-10 left-3 z-20 px-1.5 py-0.5 rounded text-xs font-bold text-yellow-300 bg-black/60 pointer-events-none">
          R
        </div>
        <div className="absolute bottom-10 right-3 z-20 px-1.5 py-0.5 rounded text-xs font-bold text-yellow-300 bg-black/60 pointer-events-none">
          L
        </div>
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%" }}
        />
        {showHeatmap && currentHeatmapUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentHeatmapUrl}
            alt="Sybil attention heatmap"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen opacity-85"
          />
        )}
        <canvas
          ref={highlightCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-[5]"
        />
        {segmentCtx?.anatomyMode && activeSegmentOverlay && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleAnatomyClick}
            className="absolute inset-0 cursor-crosshair z-10"
            title="Click to identify anatomy"
          />
        )}
        {segmentCtx?.anatomyMode && anatomyClickPin && (
          <div
            className="absolute z-20 pointer-events-none max-w-[min(280px,75%)]"
            style={{
              left: Math.min(Math.max(anatomyClickPin.x + 14, 8), (viewportContainerRef.current?.clientWidth ?? 400) - 140),
              top: Math.min(Math.max(anatomyClickPin.y - 10, 8), (viewportContainerRef.current?.clientHeight ?? 520) - 48),
              transform: "translateY(-100%)",
            }}
          >
            <div className="px-3 py-2 rounded-md text-sm font-semibold text-white bg-slate-900/92 border border-teal-400/70 shadow-xl whitespace-normal leading-snug backdrop-blur-sm">
              {anatomyClickPin.label}
            </div>
          </div>
        )}
        {segmentCtx?.anatomyMode && activeSegmentOverlay && !anatomyClickPin && !trackedLabelName && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-md text-[11px] text-teal-100 bg-black/65 border border-teal-700/50 pointer-events-none">
            Click a structure to identify and follow it across slices
          </div>
        )}
        {segmentCtx?.anatomyMode && activeSegmentOverlay && trackedLabelName && (
          <div className="absolute top-14 left-3 z-20 max-w-[min(280px,70%)] px-2.5 py-1.5 rounded-md text-[11px] text-teal-100 bg-black/75 border border-teal-500/60 pointer-events-none">
            <span className="font-semibold text-teal-300">Following:</span> {trackedLabelName}
            {!trackedOnCurrentSlice && (
              <span className="block text-slate-400 mt-0.5">Not visible on this slice</span>
            )}
          </div>
        )}
        {activeSybilOverlay && (
          <div className={cn(
            "absolute top-3 right-3 px-2.5 py-1 rounded-md text-xs font-semibold shadow-lg",
            overlayRiskBadgeColors[activeSybilOverlay.riskLevel],
          )}>
            Sybil 6yr: {(activeSybilOverlay.riskScore6yr * 100).toFixed(1)}%
          </div>
        )}
        {activeSybilOverlay && !hasHeatmaps && highRiskSet.size > 0 && (
          <div className="absolute bottom-3 left-3 right-3 text-center text-[11px] text-slate-300 bg-black/60 rounded px-2 py-1">
            Re-run Sybil analysis to generate attention heatmaps
          </div>
        )}
        {activeSybilOverlay && highRiskSet.size === 0 && (
          <div className="absolute bottom-3 left-3 right-3 text-center text-[11px] text-slate-300 bg-black/60 rounded px-2 py-1">
            No slice highlights stored — re-run Sybil analysis to refresh
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-slate-400 text-sm">Loading {total} image{total !== 1 ? "s" : ""}…</span>
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-red-400 text-sm text-center px-4">{error}</p>
          </div>
        )}
      </div>

      {/* Slice navigation */}
      {total > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2">
            <button
              onClick={() => goToSlice(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <input
              type="range" min={0} max={total - 1} value={currentIndex}
              onChange={(e) => goToSlice(Number(e.target.value))}
              className={cn("flex-1", isCurrentHighRisk ? "accent-purple-400" : "accent-blue-500")}
            />
            <button
              onClick={() => goToSlice(currentIndex + 1)}
              disabled={currentIndex === total - 1}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          {activeSybilOverlay && highRiskSet.size > 0 && (
            <div className="relative h-2 mx-3">
              {[...highRiskSet].map((index) => (
                <button
                  key={`sybil-${index}`}
                  type="button"
                  title={`Jump to slice ${index + 1}`}
                  onClick={() => goToSlice(index)}
                  className={cn(
                    "absolute top-0 w-1.5 h-1.5 rounded-full -translate-x-1/2 transition-transform hover:scale-150",
                    index === currentIndex ? "bg-purple-300 scale-150" : "bg-purple-500/80",
                  )}
                  style={{ left: `${total <= 1 ? 0 : (index / (total - 1)) * 100}%` }}
                />
              ))}
            </div>
          )}
          {flaggedSet.size > 0 && (
            <div className="relative h-3 mx-3">
              {[...flaggedSet].map((index) => (
                <button
                  key={`flag-${index}`}
                  type="button"
                  title={`Jump to flagged slice ${index + 1}`}
                  onClick={() => goToSlice(index)}
                  className="absolute top-0 -translate-x-1/2 text-amber-400 hover:text-amber-300 transition-transform hover:scale-125"
                  style={{ left: `${total <= 1 ? 0 : (index / (total - 1)) * 100}%` }}
                >
                  <Pin className={cn("w-3 h-3", index === currentIndex && "fill-current scale-110")} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
