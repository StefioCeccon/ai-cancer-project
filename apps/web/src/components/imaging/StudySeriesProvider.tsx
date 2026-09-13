"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { formatSeriesOptionLabel } from "@/lib/imaging/series";
import type { StudySeriesInfo } from "@/lib/ml/client";

interface StudySeriesContextValue {
  seriesOptions: StudySeriesInfo[];
  recommendedSeriesNumber: number | null;
  loading: boolean;
  serviceDown: boolean;
  error: string | null;
  getSeriesLabel: (seriesNumber: number, fallback: string, includeSybilNote?: boolean) => string;
}

const StudySeriesContext = createContext<StudySeriesContextValue | null>(null);

export function StudySeriesProvider({
  studyId,
  enabled,
  children,
}: {
  studyId: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [seriesOptions, setSeriesOptions] = useState<StudySeriesInfo[]>([]);
  const [recommendedSeriesNumber, setRecommendedSeriesNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [serviceDown, setServiceDown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setServiceDown(false);

    fetch(`/api/imaging/${studyId}/series`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          if (data.serviceDown) setServiceDown(true);
          setError(data.error ?? "Failed to load series metadata");
          return;
        }

        setSeriesOptions(data.data.series as StudySeriesInfo[]);
        setRecommendedSeriesNumber(data.data.recommended_series_number ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load series metadata");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [studyId, enabled]);

  const value = useMemo<StudySeriesContextValue>(() => ({
    seriesOptions,
    recommendedSeriesNumber,
    loading,
    serviceDown,
    error,
    getSeriesLabel: (seriesNumber, fallback, includeSybilNote = false) => {
      const meta = seriesOptions.find((s) => s.series_number === seriesNumber);
      if (!meta) return fallback;
      return formatSeriesOptionLabel({
        seriesNumber: meta.series_number,
        description: meta.description,
        sliceCount: meta.slice_count,
        sliceThicknessMm: meta.slice_thickness_mm,
        sybilSuitable: meta.sybil_suitable,
        includeSybilNote,
      });
    },
  }), [seriesOptions, recommendedSeriesNumber, loading, serviceDown, error]);

  return (
    <StudySeriesContext.Provider value={value}>
      {children}
    </StudySeriesContext.Provider>
  );
}

export function useStudySeries() {
  return useContext(StudySeriesContext);
}
