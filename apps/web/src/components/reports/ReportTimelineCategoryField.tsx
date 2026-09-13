"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TIMELINE_CATEGORY_OPTIONS } from "@/lib/timeline/timelineCategoryOptions";
import { readApiError } from "@/lib/upload/readApiError";

interface ReportTimelineCategoryFieldProps {
  reportId: string;
  title: string;
  clinicalSpecialty?: string | null;
  timelineCategoryManual?: boolean;
  onUpdated?: (clinicalSpecialty: string | null, manual: boolean) => void;
  compact?: boolean;
}

export function ReportTimelineCategoryField({
  reportId,
  title,
  clinicalSpecialty,
  timelineCategoryManual,
  onUpdated,
  compact,
}: ReportTimelineCategoryFieldProps) {
  const [value, setValue] = useState(clinicalSpecialty?.trim() ?? "");
  const [manual, setManual] = useState(!!timelineCategoryManual);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveCategory(nextValue: string, nextManual: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicalSpecialty: nextValue.trim() || null,
          timelineCategoryManual: nextManual,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update timeline category"));
      const data = await res.json();
      const saved = data.data?.clinicalSpecialty?.trim() || null;
      setValue(saved ?? "");
      setManual(!!data.data?.extractedData?.timelineCategoryManual);
      onUpdated?.(saved, !!data.data?.extractedData?.timelineCategoryManual);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function autoClassify() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetTimelineCategory: true }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to re-classify"));
      const data = await res.json();
      const saved = data.data?.clinicalSpecialty?.trim() || null;
      setValue(saved ?? "");
      setManual(false);
      onUpdated?.(saved, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to re-classify");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <label className={`font-medium text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>
          Timeline row
        </label>
        {manual && (
          <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
            Manual
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          list={`timeline-categories-${reportId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Otorhinolaryngology"
          className={`flex-1 min-w-[180px] border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            compact ? "py-1.5 text-sm" : "py-2 text-sm"
          }`}
        />
        <datalist id={`timeline-categories-${reportId}`}>
          {TIMELINE_CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <Button
          type="button"
          size="sm"
          loading={saving}
          onClick={() => saveCategory(value, true)}
        >
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={saving}
          onClick={autoClassify}
          title={`Re-classify from title: ${title}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Auto
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        Groups this report on the patient timeline. Pick a suggestion or type your own, then Save.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
