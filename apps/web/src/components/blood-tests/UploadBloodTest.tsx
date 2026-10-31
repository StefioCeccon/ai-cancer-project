"use client";

import { useState, useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FlaskConical, Plus, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { classifyMarkerStatus, CANCER_MARKERS } from "@ai-cancer-project/shared";
import type { MarkerStatus } from "@ai-cancer-project/shared";
import { mergeBloodMarkers, type ParsedBloodMarker } from "@/lib/upload/bloodMarkers";
import { parseStoredFilePaths } from "@/lib/upload/parseStoredFilePaths";
import { uploadPatientFile } from "@/lib/upload/uploadPatientFile";

interface MarkerRow {
  name: string;
  value: string;
  unit: string;
  referenceMin: string;
  referenceMax: string;
}

interface InitialData {
  testId: string;
  testDate: string;
  labName?: string | null;
  requestingPhysician?: string | null;
  rawText?: string | null;
  filePath?: string | null;
  markers: MarkerRow[];
}

interface UploadBloodTestProps {
  patientId: string;
  initialData?: InitialData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type ParsedFileResult = {
  fileName: string;
  rawText: string;
  markers: ParsedBloodMarker[];
  testDate: string | null;
  labName: string | null;
  warning?: string;
};

function toMarkerRows(markers: ParsedBloodMarker[]): MarkerRow[] {
  return markers.map((m) => ({
    name: m.name,
    value: String(m.value ?? ""),
    unit: m.unit ?? "",
    referenceMin: m.referenceMin != null ? String(m.referenceMin) : "",
    referenceMax: m.referenceMax != null ? String(m.referenceMax) : "",
  }));
}

export function UploadBloodTest({ patientId, initialData, onSuccess, onCancel }: UploadBloodTestProps) {
  const isEdit = !!initialData;

  const [meta, setMeta] = useState({
    testDate: initialData?.testDate ?? new Date().toISOString().split("T")[0],
    labName: initialData?.labName ?? "",
    requestingPhysician: initialData?.requestingPhysician ?? "",
  });
  const [markers, setMarkers] = useState<MarkerRow[]>(
    initialData?.markers?.length
      ? initialData.markers
      : [{ name: "", value: "", unit: "", referenceMin: "", referenceMax: "" }]
  );
  const [rawText, setRawText] = useState(initialData?.rawText ?? "");
  const [existingFilePaths, setExistingFilePaths] = useState<string[]>(() =>
    parseStoredFilePaths(initialData?.filePath)
  );
  const [uploadedFiles, setUploadedFiles] = useState<{ file: File; path: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseWarning, setParseWarning] = useState<string | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    setParseLoading(true);
    setParseWarning(null);
    setError(null);
    try {
      const uploaded = await Promise.all(
        accepted.map(async (file) => {
          const result = await uploadPatientFile(file, { patientId, type: "bloodtest" });
          return { file, path: result.path };
        })
      );
      setUploadedFiles((prev) => [...prev, ...uploaded]);

      const res = await fetch("/api/blood-tests/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          mode: "individual",
          files: uploaded.map((u) => ({ path: u.path, fileName: u.file.name })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to parse files");
      }

      const parsedFiles: ParsedFileResult[] = Array.isArray(data.files)
        ? data.files
        : [
            {
              fileName: accepted[0]!.name,
              rawText: data.rawText ?? "",
              markers: data.markers ?? [],
              testDate: data.testDate ?? null,
              labName: data.labName ?? null,
              warning: data.warning,
            },
          ];

      const mergedMarkers = mergeBloodMarkers(parsedFiles.map((f) => f.markers ?? []));
      if (mergedMarkers.length) {
        setMarkers(toMarkerRows(mergedMarkers));
      }

      const combinedRaw = parsedFiles
        .map((f) => f.rawText?.trim())
        .filter(Boolean)
        .join("\n\n---\n\n");
      if (combinedRaw) {
        setRawText((prev) => (prev ? `${prev}\n\n---\n\n${combinedRaw}` : combinedRaw));
      }

      const testDate = parsedFiles.map((f) => f.testDate).find(Boolean);
      const labName = parsedFiles.map((f) => f.labName).find(Boolean);
      if (testDate) setMeta((m) => ({ ...m, testDate }));
      if (labName) setMeta((m) => ({ ...m, labName }));

      const warnings = parsedFiles.map((f) => f.warning).filter(Boolean);
      if (warnings.length) setParseWarning(warnings.join(" · "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse files");
    } finally {
      setParseLoading(false);
    }
  }, [patientId]);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    if (!rejections.length) return;
    const reasons = rejections.flatMap((r) =>
      r.errors.map((e) => `${r.file.name}: ${e.message}`)
    );
    setError(reasons[0] ?? "File rejected");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    multiple: true,
    disabled: parseLoading,
  });

  function addMarker() {
    setMarkers((m) => [...m, { name: "", value: "", unit: "", referenceMin: "", referenceMax: "" }]);
  }

  function removeMarker(i: number) {
    setMarkers((m) => m.filter((_, idx) => idx !== i));
  }

  function updateMarker(i: number, field: keyof MarkerRow, value: string) {
    setMarkers((m) => m.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const validMarkers = markers
        .filter((m) => m.name && m.value && m.unit)
        .map((m) => {
          const value = parseFloat(m.value);
          const refMin = m.referenceMin ? parseFloat(m.referenceMin) : undefined;
          const refMax = m.referenceMax ? parseFloat(m.referenceMax) : undefined;
          return {
            name: m.name,
            value,
            unit: m.unit,
            referenceMin: refMin,
            referenceMax: refMax,
            status: classifyMarkerStatus(value, refMin, refMax) as MarkerStatus,
          };
        });

      const filePaths = [...existingFilePaths, ...uploadedFiles.map((u) => u.path)];
      const payload = {
        patientId,
        testDate: meta.testDate,
        labName: meta.labName || undefined,
        requestingPhysician: meta.requestingPhysician || undefined,
        markers: validMarkers,
        rawText: rawText || undefined,
        filePath: filePaths.length ? JSON.stringify(filePaths) : undefined,
      };

      const res = isEdit
        ? await fetch(`/api/blood-tests/${initialData.testId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/blood-tests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) throw new Error("Failed to save blood test");
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Metadata row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Test Date *</label>
          <input type="date" value={meta.testDate} onChange={(e) => setMeta((m) => ({ ...m, testDate: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Laboratory</label>
          <input type="text" value={meta.labName} placeholder="Lab name" onChange={(e) => setMeta((m) => ({ ...m, labName: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Requesting Physician</label>
          <input type="text" value={meta.requestingPhysician} placeholder="Dr. Name" onChange={(e) => setMeta((m) => ({ ...m, requestingPhysician: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* File upload */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
          parseLoading && "opacity-60 pointer-events-none",
          isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"
        )}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-slate-500">
          {parseLoading
            ? `Extracting markers with AI from ${uploadedFiles.length || "your"} file(s)...`
            : isEdit
            ? "Drop PDF/TXT/CSV/JPG/PNG files to add pages and re-parse, or edit markers below"
            : "Drop one or more PDF/TXT/CSV/JPG/PNG files — AI will extract and merge markers"}
        </p>
      </div>

      {(existingFilePaths.length > 0 || uploadedFiles.length > 0) && (
        <ul className="space-y-1">
          {existingFilePaths.map((path, i) => (
            <li
              key={`existing-${path}`}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
            >
              <span className="truncate">{path.split("/").pop()}</span>
              <button
                type="button"
                onClick={() => setExistingFilePaths((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-slate-400 hover:text-red-500"
                aria-label="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {uploadedFiles.map((entry, i) => (
            <li
              key={`${entry.path}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
            >
              <span className="truncate">{entry.file.name}</span>
              <button
                type="button"
                onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-slate-400 hover:text-red-500"
                aria-label="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Raw text */}
      {rawText && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Raw Text (parsed from file)</label>
          <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}

      {/* Markers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-blue-500" /> Markers
          </label>
          <button type="button" onClick={addMarker} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add Marker
          </button>
        </div>
        {/* Cancer marker quick-add */}
        <div className="flex flex-wrap gap-1 mb-3">
          {CANCER_MARKERS.map((name) => (
            <button
              type="button"
              key={name}
              onClick={() => setMarkers((m) => [...m, { name, value: "", unit: "U/mL", referenceMin: "", referenceMax: "" }])}
              className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
            >
              + {name}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {markers.map((marker, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3">
                <input type="text" value={marker.name} placeholder="Marker name" onChange={(e) => updateMarker(i, "name", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <input type="number" value={marker.value} placeholder="Value" onChange={(e) => updateMarker(i, "value", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <input type="text" value={marker.unit} placeholder="Unit" onChange={(e) => updateMarker(i, "unit", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <input type="number" value={marker.referenceMin} placeholder="Ref min" onChange={(e) => updateMarker(i, "referenceMin", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <input type="number" value={marker.referenceMax} placeholder="Ref max" onChange={(e) => updateMarker(i, "referenceMax", e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="col-span-1 flex justify-center">
                <button type="button" onClick={() => removeMarker(i)} className="text-slate-300 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-2 mt-1 px-0">
          <div className="col-span-3 text-xs text-slate-400 pl-1">Name</div>
          <div className="col-span-2 text-xs text-slate-400 pl-1">Value</div>
          <div className="col-span-2 text-xs text-slate-400 pl-1">Unit</div>
          <div className="col-span-2 text-xs text-slate-400 pl-1">Ref min</div>
          <div className="col-span-2 text-xs text-slate-400 pl-1">Ref max</div>
        </div>
      </div>

      {parseWarning && <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">{parseWarning}</div>}
      {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">{error}</div>}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} className="flex-1">
          <Upload className="w-4 h-4" /> {isEdit ? "Save Changes" : "Save Blood Test"}
        </Button>
      </div>
    </form>
  );
}
