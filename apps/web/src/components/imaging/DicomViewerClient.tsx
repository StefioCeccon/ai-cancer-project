"use client";

import dynamic from "next/dynamic";
import type { ImagingSeriesGroup } from "@/lib/imaging/series";

const DicomViewer = dynamic(
  () => import("@/components/imaging/DicomViewer").then((m) => m.DicomViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center bg-black rounded-lg" style={{ minHeight: 520 }}>
        <p className="text-slate-400 text-sm">Loading viewer…</p>
      </div>
    ),
  },
);

interface Props {
  studyId: string;
  seriesGroups: ImagingSeriesGroup[];
  className?: string;
}

export function DicomViewerClient(props: Props) {
  return <DicomViewer {...props} />;
}
