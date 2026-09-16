"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { HeartPulse, Plus, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import type { SymptomSeverity } from "@ai-cancer-project/shared";

interface SymptomRow {
  name: string;
  severity: SymptomSeverity | "";
  startDate: string;
  endDate: string;
  notes: string;
}

interface InitialData {
  id: string;
  name: string;
  severity?: SymptomSeverity | null;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
  rawText?: string | null;
  filePath?: string | null;
  sourceTitle?: string | null;
}

interface UploadSymptomProps {
  patientId: string;
  initialData?: InitialData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const EMPTY_ROW = (): SymptomRow => ({
  name: "",
  severity: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  notes: "",
});

export function UploadSymptom({ patientId, initialData, onSuccess, onCancel }: UploadSymptomProps) {
  const isEdit = !!initialData;

  const [rows, setRows] = useState<SymptomRow[]>([
    initialData
      ? {
          name: initialData.name,
          severity: initialData.severity ?? "",
          startDate: initialData.startDate,
          endDate: initialData.endDate ?? "",
          notes: initialData.notes ?? "",
        }
      : EMPTY_ROW(),
  ]);
  const [rawText, setRawText] = useState(initialData?.rawText ?? "");
  const [filePath, setFilePath] = useState(initialData?.filePath ?? "");
  const [sourceTitle, setSourceTitle] = useState(initialData?.sourceTitle ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseWarning, setParseWarning] = useState<string | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setParseLoading(true);
    setParseWarning(null);
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("type", "symptoms");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      const uploadData = await uploadRes.json();
      if (uploadData.data?.path) setFilePath(uploadData.data.path);

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/symptoms/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (data.rawText) setRawText(data.rawText);
      if (data.sourceTitle) setSourceTitle(data.sourceTitle);
      if (data.symptoms?.length) {
        setRows(
          data.symptoms.map((s: SymptomRow & { severity?: SymptomSeverity | null }) => ({
            name: s.name ?? "",
            severity: s.severity ?? "",
            startDate: s.startDate ?? new Date().toISOString().split("T")[0],
            endDate: s.endDate ?? "",
            notes: s.notes ?? "",
          }))
        );
      }
      if (data.warning) setParseWarning(data.warning);
    } catch {
      setError("Failed to parse file");
    } finally {
      setParseLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxFiles: 1,
  });

  function addRow() {
    setRows((r) => [...r, EMPTY_ROW()]);
  }

  function removeRow(i: number) {
    setRows((r) => (r.length <= 1 ? r : r.filter((_, idx) => idx !== i)));
  }

  function updateRow(i: number, field: keyof SymptomRow, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const validRows = rows.filter((r) => r.name.trim() && r.startDate);
      if (validRows.length === 0) throw new Error("Add at least one symptom with a name and start date");

      if (isEdit) {
        const row = validRows[0];
        const res = await fetch(`/api/symptoms/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            severity: row.severity || null,
            startDate: row.startDate,
            endDate: row.endDate || null,
            notes: row.notes || null,
            rawText: rawText || null,
            filePath: filePath || null,
            sourceTitle: sourceTitle || null,
          }),
        });
        if (!res.ok) throw new Error("Failed to save symptom");
      } else if (validRows.length === 1) {
        const row = validRows[0];
        const res = await fetch("/api/symptoms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            name: row.name,
            severity: row.severity || null,
            startDate: row.startDate,
            endDate: row.endDate || null,
            notes: row.notes || null,
            rawText: rawText || null,
            filePath: filePath || null,
            sourceTitle: sourceTitle || null,
          }),
        });
        if (!res.ok) throw new Error("Failed to save symptom");
      } else {
        const res = await fetch("/api/symptoms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            rawText: rawText || null,
            filePath: filePath || null,
            sourceTitle: sourceTitle || null,
            symptoms: validRows.map((row) => ({
              name: row.name,
              severity: row.severity || null,
              startDate: row.startDate,
              endDate: row.endDate || null,
              notes: row.notes || null,
            })),
          }),
        });
        if (!res.ok) throw new Error("Failed to save symptoms");
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isEdit && (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
            isDragActive ? "border-rose-500 bg-rose-50" : "border-slate-200 hover:border-rose-300"
          )}
        >
          <input {...getInputProps()} />
          <p className="text-sm text-slate-500">
            {parseLoading
              ? "Extracting symptoms with AI..."
              : "Drop PDF/TXT/JPG/PNG — AI will extract symptoms from visit notes or diaries"}
          </p>
        </div>
      )}

      {sourceTitle && (
        <p className="text-xs text-slate-500">Source: {sourceTitle}</p>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-rose-500" /> Symptoms
          </label>
          {!isEdit && (
            <button type="button" onClick={addRow} className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Symptom
            </button>
          )}
        </div>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="col-span-3">
                <input
                  type="text"
                  value={row.name}
                  placeholder="Symptom name *"
                  onChange={(e) => updateRow(i, "name", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>
              <div className="col-span-2">
                <select
                  value={row.severity}
                  onChange={(e) => updateRow(i, "severity", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="">Severity</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="date"
                  value={row.startDate}
                  onChange={(e) => updateRow(i, "startDate", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>
              <div className="col-span-2">
                <input
                  type="date"
                  value={row.endDate}
                  placeholder="End date"
                  onChange={(e) => updateRow(i, "endDate", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                  title="Leave empty for point-in-time or ongoing"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  value={row.notes}
                  placeholder="Notes"
                  onChange={(e) => updateRow(i, "notes", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
              <div className="col-span-1 flex justify-center pt-1">
                {!isEdit && (
                  <button type="button" onClick={() => removeRow(i)} className="text-slate-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-2 mt-1 px-3 text-xs text-slate-400">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Severity</div>
          <div className="col-span-2">Start *</div>
          <div className="col-span-2">End (optional)</div>
          <div className="col-span-2">Notes</div>
        </div>
      </div>

      {parseWarning && (
        <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">{parseWarning}</div>
      )}
      {error && (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">{error}</div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} className="flex-1">
          <Upload className="w-4 h-4" />
          {isEdit ? "Save Changes" : rows.length > 1 ? `Save ${rows.filter((r) => r.name).length} Symptoms` : "Save Symptom"}
        </Button>
      </div>
    </form>
  );
}
