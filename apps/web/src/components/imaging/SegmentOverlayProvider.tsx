"use client";

import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  clearMaskCache,
  segmentationToViewerOverlay,
  type SegmentationResult,
  type SegmentationViewerOverlay,
} from "@/lib/imaging/segmentation";

interface SegmentOverlayContextValue {
  segmentOverlay: SegmentationViewerOverlay | null;
  anatomyMode: boolean;
  setAnatomyMode: (enabled: boolean) => void;
  clickLabel: string | null;
  setClickLabel: (label: string | null) => void;
  trackedLabelId: number | null;
  trackedLabelName: string | null;
  trackOrgan: (labelId: number, labelName: string) => void;
  clearTrackedOrgan: () => void;
  structuresOnSlice: string[];
  setStructuresOnSlice: Dispatch<SetStateAction<string[]>>;
  applySegmentationResult: (result: SegmentationResult) => void;
}

const SegmentOverlayContext = createContext<SegmentOverlayContextValue | null>(null);

export function SegmentOverlayProvider({
  initialOverlay,
  children,
}: {
  initialOverlay: SegmentationViewerOverlay | null;
  children: React.ReactNode;
}) {
  const [segmentOverlay, setSegmentOverlay] = useState<SegmentationViewerOverlay | null>(initialOverlay);
  const [anatomyMode, setAnatomyMode] = useState(false);
  const [clickLabel, setClickLabel] = useState<string | null>(null);
  const [trackedLabelId, setTrackedLabelId] = useState<number | null>(null);
  const [trackedLabelName, setTrackedLabelName] = useState<string | null>(null);
  const [structuresOnSlice, setStructuresOnSlice] = useState<string[]>([]);

  const trackOrgan = useCallback((labelId: number, labelName: string) => {
    setTrackedLabelId(labelId);
    setTrackedLabelName(labelName);
    setClickLabel(labelName);
  }, []);

  const clearTrackedOrgan = useCallback(() => {
    setTrackedLabelId(null);
    setTrackedLabelName(null);
    setClickLabel(null);
  }, []);

  const applySegmentationResult = useCallback((result: SegmentationResult) => {
    clearMaskCache();
    setSegmentOverlay(segmentationToViewerOverlay(result));
    setAnatomyMode(true);
    clearTrackedOrgan();
  }, [clearTrackedOrgan]);

  const value = useMemo<SegmentOverlayContextValue>(() => ({
    segmentOverlay,
    anatomyMode,
    setAnatomyMode,
    clickLabel,
    setClickLabel,
    trackedLabelId,
    trackedLabelName,
    trackOrgan,
    clearTrackedOrgan,
    structuresOnSlice,
    setStructuresOnSlice,
    applySegmentationResult,
  }), [
    segmentOverlay,
    anatomyMode,
    clickLabel,
    trackedLabelId,
    trackedLabelName,
    trackOrgan,
    clearTrackedOrgan,
    structuresOnSlice,
    applySegmentationResult,
  ]);

  return (
    <SegmentOverlayContext.Provider value={value}>
      {children}
    </SegmentOverlayContext.Provider>
  );
}

export function useSegmentOverlay() {
  return useContext(SegmentOverlayContext);
}
