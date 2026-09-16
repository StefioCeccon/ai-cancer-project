"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scan, Cpu, Sparkles, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { formatDate } from "@ai-cancer-project/shared";

interface ImagingStudySummary {
  id: string;
  modality: string;
  bodyPart: string;
  studyDate: string;
  description?: string | null;
  aiFindings?: string | null;
  mlModelResults?: {
    sybil?: {
      risk_scores?: Record<string, number>;
      risk_level?: string;
      high_risk_instances?: number[];
      series_number?: number;
    };
  } | null;
}

interface Props {
  patientId: string;
  locale: string;
}

const riskVariant: Record<string, "success" | "warning" | "danger"> = {
  low: "success",
  elevated: "warning",
  high: "danger",
};

export function ImagingAnalysisSection({ patientId, locale }: Props) {
  const [studies, setStudies] = useState<ImagingStudySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/imaging?patientId=${patientId}`)
      .then((r) => r.json())
      .then((d) => setStudies(d.data ?? []))
      .catch(() => setStudies([]))
      .finally(() => setLoading(false));
  }, [patientId]);

  const withMl = studies.filter((s) => s.mlModelResults?.sybil || s.aiFindings);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-4 text-xs text-slate-400">Loading imaging ML data…</CardContent>
      </Card>
    );
  }

  if (studies.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          <Scan className="w-4 h-4 text-teal-600" />
          Imaging ML Results
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {withMl.length === 0 ? (
          <p className="text-xs text-slate-500">
            {studies.length} imaging {studies.length === 1 ? "study" : "studies"} on file.
            Run Sybil or AI slice analysis on a study to populate ML context for analysis runs.
          </p>
        ) : (
          withMl.map((study) => {
            const sybil = study.mlModelResults?.sybil;
            const risk6yr = sybil?.risk_scores?.["6yr"];
            return (
              <div key={study.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {study.modality} — {study.bodyPart}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(study.studyDate)}</p>
                  </div>
                  <Link
                    href={`/${locale}/imaging/${study.id}`}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {sybil && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-purple-700">
                      <Cpu className="w-3 h-3" /> Sybil
                    </span>
                    {risk6yr != null && (
                      <Badge variant={riskVariant[sybil.risk_level ?? ""] ?? "neutral"}>
                        6yr {(risk6yr * 100).toFixed(1)}%
                      </Badge>
                    )}
                    {sybil.high_risk_instances?.length ? (
                      <span className="text-slate-500">
                        {sybil.high_risk_instances.length} high-attention slices
                      </span>
                    ) : null}
                  </div>
                )}

                {study.aiFindings && (
                  <div className="text-xs">
                    <p className="flex items-center gap-1 text-blue-700 font-medium mb-1">
                      <Sparkles className="w-3 h-3" /> AI slice analysis
                    </p>
                    <div className="max-h-32 overflow-y-auto bg-slate-50 rounded p-2">
                      <MarkdownContent className="text-xs [&>h2]:text-xs [&>h3]:text-xs">
                        {study.aiFindings.length > 600
                          ? `${study.aiFindings.slice(0, 600)}…`
                          : study.aiFindings}
                      </MarkdownContent>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
