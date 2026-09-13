"use client";

import { parseStoredFilePaths } from "@/lib/upload/parseStoredFilePaths";

type FileKind = "pdf" | "image" | "text" | "other";

function getFileKind(path: string): FileKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|gif|webp)$/i.test(lower)) return "image";
  if (lower.endsWith(".txt")) return "text";
  return "other";
}

interface StoredDocumentViewerProps {
  filePath?: string | null;
  title?: string;
}

function DocumentPreview({ path, label }: { path: string; label?: string }) {
  const kind = getFileKind(path);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
        <p className="text-xs text-slate-500">{label ?? "Original file"}</p>
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          Open in new tab
        </a>
      </div>

      {kind === "pdf" && (
        <iframe
          src={path}
          title={label ?? "Original PDF"}
          className="w-full h-[min(70vh,720px)] bg-slate-100"
        />
      )}

      {kind === "image" && (
        <div className="bg-slate-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={path}
            alt={label ?? "Original document"}
            className="mx-auto w-full max-h-[70vh] object-contain"
          />
        </div>
      )}

      {kind === "text" && (
        <iframe
          src={path}
          title={label ?? "Original text file"}
          className="w-full h-64 bg-white"
        />
      )}

      {kind === "other" && (
        <div className="p-4 text-sm text-slate-600">
          Preview not available for this file type.
        </div>
      )}
    </div>
  );
}

export function StoredDocumentViewer({
  filePath,
  title = "Original Document",
}: StoredDocumentViewerProps) {
  const paths = parseStoredFilePaths(filePath);
  if (paths.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      {paths.map((path, index) => (
        <DocumentPreview
          key={`${path}-${index}`}
          path={path}
          label={paths.length > 1 ? `Page ${index + 1}` : undefined}
        />
      ))}
    </div>
  );
}
