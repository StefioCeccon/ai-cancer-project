"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { sybilResultToViewerOverlay, type SybilViewerOverlay } from "@/lib/imaging/sybil";

interface SybilResultInput {
  risk_scores: { "6yr": number };
  risk_level: "low" | "elevated" | "high";
  high_risk_instances: number[];
  high_risk_file_paths?: string[];
  heatmap_by_file?: Record<string, string>;
  series_number?: number;
}

interface StudyMlOverlayContextValue {
  sybilOverlay: SybilViewerOverlay | null;
  viewerSeriesNumber: number | undefined;
  setViewerSeriesNumber: (seriesNumber: number) => void;
  applySybilResult: (result: SybilResultInput) => void;
}

const StudyMlOverlayContext = createContext<StudyMlOverlayContextValue | null>(null);

export function StudyMlOverlayProvider({
  initialOverlay,
  initialSeriesNumber,
  children,
}: {
  initialOverlay: SybilViewerOverlay | null;
  initialSeriesNumber?: number;
  children: React.ReactNode;
}) {
  const [sybilOverlay, setSybilOverlay] = useState<SybilViewerOverlay | null>(initialOverlay);
  const [viewerSeriesNumber, setViewerSeriesNumber] = useState<number | undefined>(
    initialSeriesNumber ?? initialOverlay?.seriesNumber,
  );

  const value = useMemo<StudyMlOverlayContextValue>(() => ({
    sybilOverlay,
    viewerSeriesNumber,
    setViewerSeriesNumber,
    applySybilResult: (result) => {
      const overlay = sybilResultToViewerOverlay(result);
      setSybilOverlay(overlay);
      if (overlay) setViewerSeriesNumber(overlay.seriesNumber);
    },
  }), [sybilOverlay, viewerSeriesNumber]);

  return (
    <StudyMlOverlayContext.Provider value={value}>
      {children}
    </StudyMlOverlayContext.Provider>
  );
}

export function useStudyMlOverlay() {
  return useContext(StudyMlOverlayContext);
}
