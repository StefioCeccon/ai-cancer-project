"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileImage, X, CheckCircle2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";

interface UploadDicomProps {
  patientId: string;
  onSuccess?: (studyId: string) => void;
}

interface UploadState {
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  message?: string;
}

const MODALITY_LABELS: Record<string, string> = {
  CT: "CT",
  MRI: "MRI",
  PET: "PET",
  XRAY: "XRAY",
  ULTRASOUND: "ULTRASOUND",
  OTHER: "OTHER",
};

// Map DICOM modality codes → our enum
function normalisedModality(code: string): string {
  const map: Record<string, string> = {
    CT: "CT", MR: "MRI", PT: "PET",
    CR: "XRAY", DX: "XRAY", RG: "XRAY", RF: "XRAY",
    US: "ULTRASOUND", MG: "XRAY",
  };
  return map[code?.toUpperCase()] ?? "OTHER";
}

// Convert DICOM date YYYYMMDD → YYYY-MM-DD
function dicomDateToIso(d: string): string {
  if (!d || d.length !== 8) return new Date().toISOString().split("T")[0];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

const NON_DICOM_EXTS = [".inf", ".bat", ".txt", ".exe", ".ini", ".icns", ".ico",
  ".png", ".jpg", ".jpeg", ".pdf", ".xml", ".html", ".js", ".css"];

// Return true for files we want to keep from a folder selection
function isDicomCandidate(file: File): boolean {
  // file.name from webkitdirectory may be a relative path — use only the basename
  const name = file.name.split("/").pop()!.split("\\").pop()!;
  if (!name || name.startsWith(".")) return false;
  if (name === "DICOMDIR") return false; // index file, not an image
  const lower = name.toLowerCase();
  if (NON_DICOM_EXTS.some((ext) => lower.endsWith(ext))) return false;
  if (lower.endsWith(".dcm")) return true;
  if (!name.includes(".")) return true;                   // purely extensionless
  if (/^\d+(\.\d+)+$/.test(name)) return true;           // DICOM UID format: 1.2.840...
  return false;
}

function isDicomBytes(buf: Uint8Array): boolean {
  return (
    buf.length > 132 &&
    buf[128] === 0x44 &&
    buf[129] === 0x49 &&
    buf[130] === 0x43 &&
    buf[131] === 0x4d
  );
}

interface ParsedDicomMeta {
  modality: string;
  studyDate: string;
  bodyPart: string;
  description: string;
}

// Parse metadata from image DICOM only (skips SR, PR, etc. — same rule as upload API)
async function parseImageDicomMeta(file: File): Promise<ParsedDicomMeta | null> {
  try {
    const dicomParser = (await import("dicom-parser")).default;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isDicomBytes(bytes)) return null;

    const dataset = dicomParser.parseDicom(bytes, { untilTag: "x7fe00010" });
    const pixelEl = dataset.elements["x7fe00010"];
    if (!pixelEl || (pixelEl.length === 0 && !pixelEl.hadUndefinedLength)) return null;

    return {
      modality: normalisedModality(dataset.string("x00080060") ?? ""),
      studyDate: dicomDateToIso(dataset.string("x00080020") ?? ""),
      bodyPart: dataset.string("x00180015") ?? "",
      description: dataset.string("x00081030") ?? "",
    };
  } catch {
    return null;
  }
}

export function UploadDicom({ patientId, onSuccess }: UploadDicomProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle", progress: 0 });
  const [meta, setMeta] = useState({
    studyDate: new Date().toISOString().split("T")[0],
    bodyPart: "",
    modality: "CT",
    description: "",
  });
  const [metaParsed, setMetaParsed] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  async function autoFillMeta(candidates: File[]) {
    if (metaParsed || candidates.length === 0) return;

    const META_SCAN_LIMIT = 30;
    let scanned = 0;

    for (const file of candidates) {
      const basename = file.name.split("/").pop()!.split("\\").pop()!;
      if (basename === "DICOMDIR") continue;
      if (scanned >= META_SCAN_LIMIT) break;
      scanned++;

      const parsed = await parseImageDicomMeta(file);
      if (!parsed) continue;

      setMeta((m) => ({
        modality: parsed.modality !== "OTHER" ? parsed.modality : m.modality,
        studyDate: parsed.studyDate || m.studyDate,
        bodyPart: parsed.bodyPart || parsed.description || m.bodyPart,
        description: parsed.description || m.description,
      }));
      setMetaParsed(true);
      return;
    }
  }

  const addFiles = useCallback(async (incoming: File[]) => {
    const candidates = incoming.filter(isDicomCandidate);
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...candidates.filter((f) => !existingNames.has(f.name))];
    });
    await autoFillMeta(candidates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaParsed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: addFiles,
    // Accept .dcm, extensionless DICOM (octet-stream with no ext), and zip
    accept: {
      "application/octet-stream": [],   // catches extensionless UID files
      "application/dicom": [".dcm"],
      "application/zip": [".zip"],
    },
    noClick: true, // we handle click ourselves with the folder button
    multiple: true,
  });

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    addFiles(selected);
    e.target.value = "";
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploadState({ status: "uploading", progress: 10 });

    try {
      const studyRes = await fetch("/api/imaging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          modality: meta.modality,
          studyDate: meta.studyDate,
          bodyPart: meta.bodyPart,
          description: meta.description,
          seriesCount: 1,
          instanceCount: files.length,
        }),
      });

      if (!studyRes.ok) throw new Error("Failed to create study record");
      const { data: study } = await studyRes.json();

      setUploadState({ status: "uploading", progress: 20 });

      // Upload in batches of 5 to avoid request size limits
      const BATCH = 5;
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const formData = new FormData();
        formData.append("studyId", study.id);
        batch.forEach((f) => formData.append("files", f));
        const uploadRes = await fetch("/api/imaging/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("Failed to upload files");
        setUploadState({
          status: "uploading",
          progress: 20 + Math.round(((i + batch.length) / files.length) * 80),
        });
      }

      setUploadState({ status: "success", progress: 100, message: `Uploaded ${files.length} file${files.length !== 1 ? "s" : ""}` });
      onSuccess?.(study.id);
    } catch (e) {
      setUploadState({
        status: "error",
        progress: 0,
        message: e instanceof Error ? e.message : "Upload failed",
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Modality</label>
          <select
            value={meta.modality}
            onChange={(e) => setMeta((m) => ({ ...m, modality: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.keys(MODALITY_LABELS).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Study Date</label>
          <input
            type="date"
            value={meta.studyDate}
            onChange={(e) => setMeta((m) => ({ ...m, studyDate: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Body Part</label>
          <input
            type="text"
            value={meta.bodyPart}
            placeholder="e.g. Chest, Abdomen (optional)"
            onChange={(e) => setMeta((m) => ({ ...m, bodyPart: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input
            type="text"
            value={meta.description}
            placeholder="Optional"
            onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Hidden folder input */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is non-standard
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
          isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-600 font-medium text-sm">
          Drag DICOM files here
        </p>
        <p className="text-slate-400 text-xs mt-1 mb-3">
          Accepts .dcm, extensionless DICOM UID files, .zip archives
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => folderInputRef.current?.click()}
        >
          <FolderOpen className="w-4 h-4" />
          Select DICOM Folder
        </Button>
        <p className="text-slate-400 text-xs mt-2">
          Select the <code className="bg-slate-100 px-1 rounded">DICOM/</code> subfolder <em>or</em> the whole CD root — non-imaging files are filtered automatically
        </p>
      </div>

      {metaParsed && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          Metadata auto-filled from DICOM headers — review and adjust if needed
        </p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
          <p className="text-xs font-medium text-slate-500 px-1 pb-1">{files.length} file{files.length !== 1 ? "s" : ""} selected</p>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded">
              <FileImage className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-xs text-slate-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => removeFile(i)} className="text-slate-300 hover:text-red-500 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Progress/status */}
      {uploadState.status === "uploading" && (
        <div className="space-y-1">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadState.progress}%` }} />
          </div>
          <p className="text-sm text-slate-500">Uploading... {uploadState.progress}%</p>
        </div>
      )}
      {uploadState.status === "success" && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm">{uploadState.message}</span>
        </div>
      )}
      {uploadState.status === "error" && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          {uploadState.message}
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={files.length === 0 || uploadState.status === "uploading"}
        loading={uploadState.status === "uploading"}
        className="w-full"
      >
        <Upload className="w-4 h-4" />
        Upload {files.length > 0 ? `${files.length} file${files.length !== 1 ? "s" : ""}` : "Files"}
      </Button>
    </div>
  );
}
