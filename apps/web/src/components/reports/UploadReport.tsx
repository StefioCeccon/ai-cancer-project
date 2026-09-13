"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Upload, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import type { ReportType } from "@cancer-monitor/shared";
import type { ParsedReportMetadata } from "@/app/api/reports/parse/route";
import { parseStoredFilePaths } from "@/lib/upload/parseStoredFilePaths";
import { readApiError } from "@/lib/upload/readApiError";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "visit_note", label: "Visit Note" },
  { value: "pathology", label: "Pathology" },
  { value: "radiology", label: "Radiology" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "treatment_plan", label: "Treatment Plan" },
  { value: "prescription", label: "Prescription" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

interface InitialData {
  reportId: string;
  title: string;
  reportType: ReportType;
  reportDate: string;
  author?: string | null;
  institution?: string | null;
  rawText?: string | null;
  aiSummary?: string | null;
  filePath?: string | null;
}

interface UploadReportProps {
  patientId: string;
  initialData?: InitialData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type AiFilledKey = keyof Pick<typeof defaultMeta, "title" | "reportType" | "reportDate" | "author" | "institution">;

const defaultMeta = {
  title: "",
  reportType: "visit_note" as ReportType,
  reportDate: new Date().toISOString().split("T")[0],
  author: "",
  institution: "",
};

export function UploadReport({ patientId, initialData, onSuccess, onCancel }: UploadReportProps) {
  const isEdit = !!initialData;

  const [meta, setMeta] = useState({
    title: initialData?.title ?? "",
    reportType: initialData?.reportType ?? ("visit_note" as ReportType),
    reportDate: initialData?.reportDate ?? new Date().toISOString().split("T")[0],
    author: initialData?.author ?? "",
    institution: initialData?.institution ?? "",
  });
  const [aiFilledKeys, setAiFilledKeys] = useState<Set<AiFilledKey>>(new Set());
  const [rawText, setRawText] = useState(initialData?.rawText ?? "");
  const [aiSummary, setAiSummary] = useState(initialData?.aiSummary ?? "");
  const [existingFilePaths, setExistingFilePaths] = useState<string[]>(
    () => parseStoredFilePaths(initialData?.filePath)
  );
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setMeta({
      title: initialData.title,
      reportType: initialData.reportType,
      reportDate: initialData.reportDate,
      author: initialData.author ?? "",
      institution: initialData.institution ?? "",
    });
    setRawText(initialData.rawText ?? "");
    setAiSummary(initialData.aiSummary ?? "");
    setExistingFilePaths(parseStoredFilePaths(initialData.filePath));
    setAiFilledKeys(new Set());
    setFiles([]);
  }, [initialData]);

  function updateMeta(key: AiFilledKey, value: string) {
    setMeta((m) => ({ ...m, [key]: value }));
    setAiFilledKeys((s) => { const next = new Set(s); next.delete(key); return next; });
  }

  const applyAiMetadata = useCallback((metadata: ParsedReportMetadata, firstFileName: string) => {
    const filled = new Set<AiFilledKey>();
    setMeta((prev) => {
      const next = { ...prev };

      if (metadata.title) { next.title = metadata.title; filled.add("title"); }
      else if (!prev.title) next.title = firstFileName.replace(/\.[^.]+$/, "");

      if (metadata.reportType) { next.reportType = metadata.reportType; filled.add("reportType"); }
      if (metadata.date) { next.reportDate = metadata.date; filled.add("reportDate"); }
      if (metadata.author) { next.author = metadata.author; filled.add("author"); }
      if (metadata.institution) { next.institution = metadata.institution; filled.add("institution"); }

      return next;
    });
    setAiFilledKeys(filled);
  }, []);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    setFiles((prev) => [...prev, ...accepted]);
    setIsParsing(true);
    try {
      const fd = new FormData();
      accepted.forEach((f) => fd.append("files", f));
      // also include previously added files
      const res = await fetch("/api/reports/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (data.text) setRawText((prev) => prev ? `${prev}\n\n---\n\n${data.text}` : data.text);
      if (data.metadata) applyAiMetadata(data.metadata, accepted[0].name);
    } catch {
      // silent fail — user can edit manually
    } finally {
      setIsParsing(false);
    }
  }, [applyAiMetadata]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    multiple: true,
  });

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExistingFile(index: number) {
    setExistingFilePaths((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const filePaths: string[] = [...existingFilePaths];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "report");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (!uploadRes.ok) {
          throw new Error(await readApiError(uploadRes, `Failed to upload "${file.name}"`));
        }
        const uploadData = await uploadRes.json();
        if (uploadData.data?.path) filePaths.push(uploadData.data.path);
      }

      const payload = {
        ...meta,
        author: meta.author || undefined,
        institution: meta.institution || undefined,
        rawText: rawText || undefined,
        aiSummary: aiSummary || undefined,
        filePath: filePaths.length ? JSON.stringify(filePaths) : undefined,
      };

      const res = isEdit
        ? await fetch(`/api/reports/${initialData.reportId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId, ...payload }),
          });

      if (!res.ok) {
        throw new Error(await readApiError(res, isEdit ? "Failed to update report" : "Failed to save report"));
      }
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving");
    } finally {
      setIsSubmitting(false);
    }
  }

  function AiTag() {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded px-1 py-0.5 ml-1">
        <Sparkles className="w-2.5 h-2.5" /> AI
      </span>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Title * {aiFilledKeys.has("title") && <AiTag />}
          </label>
          <input
            type="text"
            value={meta.title}
            placeholder="Report title"
            onChange={(e) => updateMeta("title", e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Type * {aiFilledKeys.has("reportType") && <AiTag />}
          </label>
          <select
            value={meta.reportType}
            onChange={(e) => updateMeta("reportType", e.target.value as ReportType)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Date * {aiFilledKeys.has("reportDate") && <AiTag />}
          </label>
          <input
            type="date"
            value={meta.reportDate}
            onChange={(e) => updateMeta("reportDate", e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Author {aiFilledKeys.has("author") && <AiTag />}
          </label>
          <input
            type="text"
            value={meta.author}
            placeholder="Dr. Name"
            onChange={(e) => updateMeta("author", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Institution {aiFilledKeys.has("institution") && <AiTag />}
          </label>
          <input
            type="text"
            value={meta.institution}
            placeholder="Hospital / Clinic"
            onChange={(e) => updateMeta("institution", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
          isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"
        )}
      >
        <input {...getInputProps()} />
        <FileText className="w-6 h-6 text-slate-400 mx-auto mb-1" />
        <p className="text-sm text-slate-500">
          {isParsing
            ? "Extracting text & metadata with AI..."
            : isEdit
              ? "Drop new files to append, or edit fields below"
              : "Drop PDF, TXT, JPG, or PNG files — AI extracts text and fills fields above"}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Multiple files supported</p>
      </div>

      {existingFilePaths.length > 0 && (
        <ul className="space-y-1">
          {existingFilePaths.map((path, i) => (
            <li key={path} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              <a
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 truncate max-w-[80%]"
              >
                Saved file {existingFilePaths.length > 1 ? `${i + 1}` : ""}
              </a>
              <button
                type="button"
                onClick={() => removeExistingFile(i)}
                className="text-slate-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                title="Remove saved file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              <span className="text-slate-700 truncate max-w-[80%]">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-slate-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Report Text</label>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={6}
          placeholder="Paste report text here, or upload files above to auto-extract..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </div>

      {(isEdit || aiSummary) && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">AI Summary</label>
          <textarea
            value={aiSummary}
            onChange={(e) => setAiSummary(e.target.value)}
            rows={3}
            placeholder="AI-generated summary, if any..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">{error}</div>}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} className="flex-1">
          <Upload className="w-4 h-4" /> {isEdit ? "Save Changes" : "Save Report"}
        </Button>
      </div>
    </form>
  );
}
