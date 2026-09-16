"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ReportType } from "@ai-cancer-project/shared";
import type { ParsedReportMetadata } from "@/lib/upload/parseReportFile";
import {
  autoGroupFiles,
  combineTexts,
  isMultiPageFileGroup,
  isImageFileName,
  metadataKey,
  sortFilesByPage,
} from "@/lib/upload/groupFiles";
import {
  BulkFileGrouper,
  newClientId,
  type GroupedFileEntry,
  type FileGroup,
} from "@/components/upload/BulkFileGrouper";

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

interface ReportFileEntry extends GroupedFileEntry {
  text?: string;
  metadata?: ParsedReportMetadata;
}

interface ReportGroup extends FileGroup<ReportFileEntry> {
  title: string;
  reportType: ReportType;
  reportDate: string;
  author: string;
  institution: string;
}

interface BulkUploadReportsProps {
  patientId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function reportMetadataKey(
  parts: Pick<ParsedReportMetadata, "date" | "institution" | "reportType" | "title" | "author">
): string | null {
  const key = metadataKey([
    parts.date,
    parts.institution,
    parts.reportType,
    parts.title,
    parts.author,
  ]);
  return key || null;
}

function matchGroupForFile(file: ReportFileEntry, groups: ReportGroup[]): string | null {
  const isImage = isImageFileName(file.file.name);
  for (const group of groups) {
    if (isMultiPageFileGroup([file, ...group.files])) {
      return group.id;
    }
    if (isImage) continue;
    const fileMeta = file.metadata ? reportMetadataKey(file.metadata) : null;
    const groupMeta = group.files[0]?.metadata
      ? reportMetadataKey(group.files[0].metadata)
      : reportMetadataKey({
          date: group.reportDate,
          institution: group.institution,
          reportType: group.reportType,
          title: group.title,
          author: group.author,
        });
    if (fileMeta && groupMeta && fileMeta === groupMeta) {
      return group.id;
    }
  }
  return null;
}

function buildGroupMeta(files: ReportFileEntry[]): Omit<ReportGroup, "id" | "files"> {
  const sorted = sortFilesByPage(files);
  const first = sorted[0];
  const meta = sorted.map((f) => f.metadata).find(Boolean);

  return {
    title: meta?.title ?? first?.file.name.replace(/\.[^.]+$/, "") ?? "Untitled Report",
    reportType: meta?.reportType ?? "visit_note",
    reportDate: meta?.date ?? new Date().toISOString().split("T")[0],
    author: meta?.author ?? "",
    institution: meta?.institution ?? "",
  };
}

function mergeNewFilesIntoGroups(existing: ReportGroup[], newEntries: ReportFileEntry[]): ReportGroup[] {
  const next = existing.map((g) => ({ ...g, files: [...g.files] }));
  const unmatched: ReportFileEntry[] = [];

  for (const entry of newEntries) {
    const groupId = matchGroupForFile(entry, next);
    if (groupId) {
      const group = next.find((g) => g.id === groupId)!;
      group.files = sortFilesByPage([...group.files, entry]);
      Object.assign(group, buildGroupMeta(group.files));
    } else {
      unmatched.push(entry);
    }
  }

  if (unmatched.length === 0) return next;

  const newGroups = autoGroupFiles(unmatched, (e) => {
    if (isImageFileName(e.file.name)) return null;
    return e.metadata ? reportMetadataKey(e.metadata) : null;
  }).map((files) => ({
    id: newClientId(),
    files,
    ...buildGroupMeta(files),
  }));

  return [...next, ...newGroups];
}

export function BulkUploadReports({ patientId, onSuccess, onCancel }: BulkUploadReportsProps) {
  const [groups, setGroups] = useState<ReportGroup[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseAndGroup = useCallback(async (files: File[]) => {
    const placeholders: ReportFileEntry[] = files.map((file) => ({
      clientId: newClientId(),
      file,
      parsing: true,
    }));

    setGroups((prev) => [...prev, ...placeholders.map((p) => ({
      id: newClientId(),
      files: [p],
      ...buildGroupMeta([]),
    }))]);
    setIsParsing(true);

    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("mode", "individual");
      const res = await fetch("/api/reports/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      type ParsedReportFile = { fileName: string; text: string; metadata: ParsedReportMetadata };
      const parsedByName = new Map<string, ParsedReportFile>(
        (data.files ?? []).map((p: ParsedReportFile): [string, ParsedReportFile] => [
          p.fileName,
          p,
        ])
      );

      setGroups((prev) => {
        const parsedNew: ReportFileEntry[] = placeholders.map((entry) => {
          const parsed = parsedByName.get(entry.file.name);
          if (!parsed) {
            return { ...entry, parsing: false, parseError: "Failed to parse" };
          }
          return {
            ...entry,
            parsing: false,
            text: parsed.text,
            metadata: parsed.metadata,
          };
        });

        const existing = prev
          .map((g) => ({
            ...g,
            files: g.files.filter((f) => !f.parsing),
          }))
          .filter((g) => g.files.length > 0);

        if (existing.length === 0) {
          return mergeNewFilesIntoGroups([], parsedNew);
        }
        return mergeNewFilesIntoGroups(existing, parsedNew);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse files");
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          files: g.files.map((f) =>
            f.parsing ? { ...f, parsing: false, parseError: "Parse failed" } : f
          ),
        }))
      );
    } finally {
      setIsParsing(false);
    }
  }, []);

  function updateGroup(groupId: string, patch: Partial<ReportGroup>) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  }

  function removeFile(groupId: string, clientId: string) {
    setGroups((prev) => {
      const next = prev
        .map((g) =>
          g.id === groupId ? { ...g, files: g.files.filter((f) => f.clientId !== clientId) } : g
        )
        .filter((g) => g.files.length > 0);
      return next.length ? next : [{ id: newClientId(), files: [], ...buildGroupMeta([]) }];
    });
  }

  function moveFile(fromGroupId: string, clientId: string, toGroupId: string) {
    if (fromGroupId === toGroupId) return;
    setGroups((prev) => {
      let moved: ReportFileEntry | undefined;
      const without = prev.map((g) => {
        if (g.id !== fromGroupId) return g;
        moved = g.files.find((f) => f.clientId === clientId);
        return { ...g, files: g.files.filter((f) => f.clientId !== clientId) };
      });
      if (!moved) return prev;
      return without
        .map((g) => (g.id === toGroupId ? { ...g, files: sortFilesByPage([...g.files, moved!]) } : g))
        .filter((g) => g.files.length > 0);
    });
  }

  function reorderFile(groupId: string, clientId: string, direction: "up" | "down") {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const idx = g.files.findIndex((f) => f.clientId === clientId);
        if (idx < 0) return g;
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= g.files.length) return g;
        const files = [...g.files];
        [files[idx], files[newIdx]] = [files[newIdx], files[idx]];
        return { ...g, files };
      })
    );
  }

  function addGroup() {
    setGroups((prev) => [
      ...prev,
      { id: newClientId(), files: [], ...buildGroupMeta([]) },
    ]);
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => {
      const target = prev.find((g) => g.id === groupId);
      if (!target) return prev;
      const rest = prev.filter((g) => g.id !== groupId);
      if (rest.length === 0) return [{ id: newClientId(), files: target.files, ...buildGroupMeta(target.files) }];
      if (target.files.length === 0) return rest;
      return rest.map((g, i) =>
        i === 0 ? { ...g, files: sortFilesByPage([...target.files, ...g.files]) } : g
      );
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validGroups = groups.filter((g) => g.files.length > 0 && g.title.trim());
    if (!validGroups.length) {
      setError("Add at least one file and set a title for each group");
      return;
    }

    setIsSubmitting(true);
    try {
      for (const group of validGroups) {
        const filePaths: string[] = [];
        for (const entry of group.files) {
          const fd = new FormData();
          fd.append("file", entry.file);
          fd.append("type", "report");
          const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
          if (!uploadRes.ok) {
            throw new Error(`Failed to upload "${entry.file.name}"`);
          }
          const uploadData = await uploadRes.json();
          if (uploadData.data?.path) filePaths.push(uploadData.data.path);
        }

        const rawText = combineTexts(group.files.map((f) => f.text));

        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            title: group.title,
            reportType: group.reportType,
            reportDate: group.reportDate,
            author: group.author || undefined,
            institution: group.institution || undefined,
            rawText: rawText || undefined,
            filePath: filePaths.length ? JSON.stringify(filePaths) : undefined,
          }),
        });
        if (!res.ok) throw new Error(`Failed to save "${group.title}"`);
      }
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving reports");
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayGroups = groups;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <BulkFileGrouper<ReportFileEntry, ReportGroup>
        groups={displayGroups}
        accept={{
          "application/pdf": [".pdf"],
          "text/plain": [".txt"],
          "image/jpeg": [".jpg", ".jpeg"],
          "image/png": [".png"],
        }}
        dropLabel="Drop report files (PDF, TXT, JPG, PNG)"
        isProcessing={isParsing}
        onFilesAdded={parseAndGroup}
        onRemoveFile={removeFile}
        onMoveFile={moveFile}
        onReorderFile={reorderFile}
        onAddGroup={addGroup}
        onRemoveGroup={removeGroup}
        renderGroupHeader={(group) => (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={group.title}
              onChange={(e) => updateGroup(group.id, { title: e.target.value })}
              placeholder="Report title"
              className="col-span-2 w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={group.reportType}
              onChange={(e) => updateGroup(group.id, { reportType: e.target.value as ReportType })}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={group.reportDate}
              onChange={(e) => updateGroup(group.id, { reportDate: e.target.value })}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={group.author}
              onChange={(e) => updateGroup(group.id, { author: e.target.value })}
              placeholder="Author"
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={group.institution}
              onChange={(e) => updateGroup(group.id, { institution: e.target.value })}
              placeholder="Institution"
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
        renderFileExtra={(file) =>
          file.text ? (
            <p className="text-xs text-slate-400 line-clamp-1">{file.text.slice(0, 120)}…</p>
          ) : null
        }
      />

      {error && (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">{error}</div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={isParsing || groups.every((g) => g.files.length === 0)}
          className="flex-1"
        >
          <Upload className="w-4 h-4" />
          Save {groups.filter((g) => g.files.length > 0).length || ""} Report
          {groups.filter((g) => g.files.length > 0).length !== 1 ? "s" : ""}
        </Button>
      </div>
    </form>
  );
}
