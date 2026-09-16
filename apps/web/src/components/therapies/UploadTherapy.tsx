"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Pill, Plus, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import type { TherapyType } from "@ai-cancer-project/shared";

interface MedicationRow {
  name: string;
  startDate: string;
  dosage: string;
  frequency: string;
  route: string;
  notes: string;
}

interface TherapyRow {
  name: string;
  therapyType: TherapyType;
  startDate: string;
  endDate: string;
  dosage: string;
  frequency: string;
  notes: string;
  medications: MedicationRow[];
}

interface InitialData {
  id: string;
  name: string;
  therapyType: TherapyType;
  startDate: string;
  endDate?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  notes?: string | null;
  rawText?: string | null;
  filePath?: string | null;
  sourceTitle?: string | null;
  medications: MedicationRow[];
}

interface UploadTherapyProps {
  patientId: string;
  initialData?: InitialData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const THERAPY_TYPES: { value: TherapyType; label: string }[] = [
  { value: "chemotherapy", label: "Chemotherapy" },
  { value: "immunotherapy", label: "Immunotherapy" },
  { value: "radiation", label: "Radiation" },
  { value: "surgery", label: "Surgery" },
  { value: "targeted_therapy", label: "Targeted Therapy" },
  { value: "hormone_therapy", label: "Hormone Therapy" },
  { value: "supportive_care", label: "Supportive Care" },
  { value: "other", label: "Other" },
];

const EMPTY_MED = (): MedicationRow => ({
  name: "",
  startDate: "",
  dosage: "",
  frequency: "",
  route: "",
  notes: "",
});

const EMPTY_THERAPY = (): TherapyRow => ({
  name: "",
  therapyType: "other",
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  dosage: "",
  frequency: "",
  notes: "",
  medications: [],
});

export function UploadTherapy({ patientId, initialData, onSuccess, onCancel }: UploadTherapyProps) {
  const isEdit = !!initialData;

  const [rows, setRows] = useState<TherapyRow[]>([
    initialData
      ? {
          name: initialData.name,
          therapyType: initialData.therapyType,
          startDate: initialData.startDate,
          endDate: initialData.endDate ?? "",
          dosage: initialData.dosage ?? "",
          frequency: initialData.frequency ?? "",
          notes: initialData.notes ?? "",
          medications: initialData.medications.length
            ? initialData.medications
            : [],
        }
      : EMPTY_THERAPY(),
  ]);
  const [rawText, setRawText] = useState(initialData?.rawText ?? "");
  const [filePath, setFilePath] = useState(initialData?.filePath ?? "");
  const [sourceTitle, setSourceTitle] = useState(initialData?.sourceTitle ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [expandedMedRow, setExpandedMedRow] = useState<number | null>(isEdit ? 0 : null);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setParseLoading(true);
    setParseWarning(null);
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("type", "therapies");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      const uploadData = await uploadRes.json();
      if (uploadData.data?.path) setFilePath(uploadData.data.path);

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/therapies/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (data.rawText) setRawText(data.rawText);
      if (data.sourceTitle) setSourceTitle(data.sourceTitle);
      if (data.therapies?.length) {
        setRows(
          data.therapies.map((t: TherapyRow) => ({
            name: t.name ?? "",
            therapyType: t.therapyType ?? "other",
            startDate: t.startDate ?? new Date().toISOString().split("T")[0],
            endDate: t.endDate ?? "",
            dosage: t.dosage ?? "",
            frequency: t.frequency ?? "",
            notes: t.notes ?? "",
            medications: (t.medications ?? []).map((m: MedicationRow) => ({
              name: m.name ?? "",
              startDate: m.startDate ?? "",
              dosage: m.dosage ?? "",
              frequency: m.frequency ?? "",
              route: m.route ?? "",
              notes: m.notes ?? "",
            })),
          }))
        );
        setExpandedMedRow(0);
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
    setRows((r) => [...r, EMPTY_THERAPY()]);
  }

  function removeRow(i: number) {
    setRows((r) => (r.length <= 1 ? r : r.filter((_, idx) => idx !== i)));
  }

  function updateRow(i: number, field: keyof Omit<TherapyRow, "medications">, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  function addMedication(therapyIdx: number) {
    setRows((r) =>
      r.map((row, idx) =>
        idx === therapyIdx ? { ...row, medications: [...row.medications, EMPTY_MED()] } : row
      )
    );
    setExpandedMedRow(therapyIdx);
  }

  function removeMedication(therapyIdx: number, medIdx: number) {
    setRows((r) =>
      r.map((row, idx) =>
        idx === therapyIdx
          ? { ...row, medications: row.medications.filter((_, i) => i !== medIdx) }
          : row
      )
    );
  }

  function updateMedication(therapyIdx: number, medIdx: number, field: keyof MedicationRow, value: string) {
    setRows((r) =>
      r.map((row, idx) =>
        idx === therapyIdx
          ? {
              ...row,
              medications: row.medications.map((m, i) =>
                i === medIdx ? { ...m, [field]: value } : m
              ),
            }
          : row
      )
    );
  }

  function serializeTherapy(row: TherapyRow) {
    const meds = row.medications
      .filter((m) => m.name.trim())
      .map((m) => ({
        name: m.name,
        startDate: m.startDate || null,
        dosage: m.dosage || null,
        frequency: m.frequency || null,
        route: m.route || null,
        notes: m.notes || null,
      }));
    return {
      name: row.name,
      therapyType: row.therapyType,
      startDate: row.startDate,
      endDate: row.endDate || null,
      dosage: row.dosage || null,
      frequency: row.frequency || null,
      notes: row.notes || null,
      medications: meds,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const validRows = rows.filter((r) => r.name.trim() && r.startDate);
      if (validRows.length === 0) throw new Error("Add at least one therapy with a name and start date");

      if (isEdit) {
        const res = await fetch(`/api/therapies/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...serializeTherapy(validRows[0]),
            rawText: rawText || null,
            filePath: filePath || null,
            sourceTitle: sourceTitle || null,
          }),
        });
        if (!res.ok) throw new Error("Failed to save therapy");
      } else if (validRows.length === 1) {
        const res = await fetch("/api/therapies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            ...serializeTherapy(validRows[0]),
            rawText: rawText || null,
            filePath: filePath || null,
            sourceTitle: sourceTitle || null,
          }),
        });
        if (!res.ok) throw new Error("Failed to save therapy");
      } else {
        const res = await fetch("/api/therapies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            rawText: rawText || null,
            filePath: filePath || null,
            sourceTitle: sourceTitle || null,
            therapies: validRows.map(serializeTherapy),
          }),
        });
        if (!res.ok) throw new Error("Failed to save therapies");
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
            isDragActive ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"
          )}
        >
          <input {...getInputProps()} />
          <p className="text-sm text-slate-500">
            {parseLoading
              ? "Extracting therapies with AI..."
              : "Drop PDF/TXT/JPG/PNG — AI will extract treatments, dosages, and medications"}
          </p>
        </div>
      )}

      {sourceTitle && <p className="text-xs text-slate-500">Source: {sourceTitle}</p>}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Pill className="w-4 h-4 text-emerald-600" /> Therapies
          </label>
          {!isEdit && (
            <button type="button" onClick={addRow} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Therapy
            </button>
          )}
        </div>

        {rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-12 gap-2 p-3 bg-slate-50 border-b border-slate-100">
              <div className="col-span-3">
                <input
                  type="text"
                  value={row.name}
                  placeholder="Therapy name *"
                  onChange={(e) => updateRow(i, "name", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
              <div className="col-span-2">
                <select
                  value={row.therapyType}
                  onChange={(e) => updateRow(i, "therapyType", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {THERAPY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <input type="date" value={row.startDate} onChange={(e) => updateRow(i, "startDate", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" required />
              </div>
              <div className="col-span-2">
                <input type="date" value={row.endDate} onChange={(e) => updateRow(i, "endDate", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  title="Leave empty for ongoing or point-in-time" />
              </div>
              <div className="col-span-2">
                <input type="text" value={row.dosage} placeholder="Dosage" onChange={(e) => updateRow(i, "dosage", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div className="col-span-1 flex justify-end gap-1">
                {!isEdit && rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="text-slate-300 hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2 p-3 border-b border-slate-100">
              <div className="col-span-4">
                <input type="text" value={row.frequency} placeholder="Frequency (e.g. every 3 weeks)" onChange={(e) => updateRow(i, "frequency", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div className="col-span-8">
                <input type="text" value={row.notes} placeholder="Notes" onChange={(e) => updateRow(i, "notes", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
            </div>

            {/* Medications */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Medications</span>
                <button type="button" onClick={() => addMedication(i)} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Medication
                </button>
              </div>
              {(expandedMedRow === i || row.medications.length > 0) && (
                <div className="space-y-2">
                  {row.medications.length === 0 && (
                    <p className="text-xs text-slate-400">No medications attached — click Add Medication</p>
                  )}
                  {row.medications.map((med, mi) => (
                    <div key={mi} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <input type="text" value={med.name} placeholder="Drug name" onChange={(e) => updateMedication(i, mi, "name", e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="col-span-2">
                        <input type="date" value={med.startDate} title="Effective from" onChange={(e) => updateMedication(i, mi, "startDate", e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="col-span-2">
                        <input type="text" value={med.dosage} placeholder="Dosage" onChange={(e) => updateMedication(i, mi, "dosage", e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="col-span-2">
                        <input type="text" value={med.frequency} placeholder="Frequency" onChange={(e) => updateMedication(i, mi, "frequency", e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="col-span-1">
                        <input type="text" value={med.route} placeholder="Route" onChange={(e) => updateMedication(i, mi, "route", e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="col-span-1">
                        <input type="text" value={med.notes} placeholder="Notes" onChange={(e) => updateMedication(i, mi, "notes", e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button type="button" onClick={() => removeMedication(i, mi)} className="text-slate-300 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {expandedMedRow !== i && row.medications.length === 0 && (
                <button type="button" onClick={() => setExpandedMedRow(i)} className="text-xs text-slate-400 hover:text-slate-600">
                  Show medications section
                </button>
              )}
            </div>
          </div>
        ))}
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
          {isEdit ? "Save Changes" : rows.length > 1 ? `Save ${rows.filter((r) => r.name).length} Therapies` : "Save Therapy"}
        </Button>
      </div>
    </form>
  );
}
