"use client";

import { useState, useCallback } from "react";
import { Upload, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mergeBloodMarkers, type ParsedBloodMarker } from "@/lib/upload/bloodMarkers";
import { prepareBloodMarkersForSave } from "@/lib/upload/prepareBloodMarkersForSave";
import { readApiError } from "@/lib/upload/readApiError";
import { assertFileReadable } from "@/lib/upload/assertFileReadable";
import { autoGroupFiles, combineTexts, metadataKey, normalizeFileStem, sortFilesByPage } from "@/lib/upload/groupFiles";
import {
  BulkFileGrouper,
  newClientId,
  type GroupedFileEntry,
  type FileGroup,
} from "@/components/upload/BulkFileGrouper";

interface BloodFileEntry extends GroupedFileEntry {
  rawText?: string;
  markers?: ParsedBloodMarker[];
  testDate?: string | null;
  labName?: string | null;
  warning?: string;
}

interface BloodGroup extends FileGroup<BloodFileEntry> {
  testDate: string;
  labName: string;
  requestingPhysician: string;
  markerCount: number;
}

interface BulkUploadBloodTestsProps {
  patientId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function matchGroupForFile(file: BloodFileEntry, groups: BloodGroup[]): string | null {
  const stem = normalizeFileStem(file.file.name);
  for (const group of groups) {
    if (group.files.some((f) => normalizeFileStem(f.file.name) === stem)) {
      return group.id;
    }
    const fileMeta = file.testDate || file.labName ? metadataKey([file.testDate, file.labName]) : null;
    const groupMeta = metadataKey([group.testDate, group.labName]);
    if (fileMeta && groupMeta && fileMeta === groupMeta) return group.id;
  }
  return null;
}

function buildGroupMeta(files: BloodFileEntry[]): Omit<BloodGroup, "id" | "files"> {
  const sorted = sortFilesByPage(files);
  const testDate =
    sorted.map((f) => f.testDate).find(Boolean) ?? new Date().toISOString().split("T")[0];
  const labName = sorted.map((f) => f.labName).find(Boolean) ?? "";
  const markers = mergeBloodMarkers(sorted.map((f) => f.markers ?? []));

  return {
    testDate,
    labName,
    requestingPhysician: "",
    markerCount: markers.length,
  };
}

function mergeNewFilesIntoGroups(existing: BloodGroup[], newEntries: BloodFileEntry[]): BloodGroup[] {
  const next = existing.map((g) => ({ ...g, files: [...g.files] }));
  const unmatched: BloodFileEntry[] = [];

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

  const newGroups = autoGroupFiles(unmatched, (e) =>
    e.testDate || e.labName ? metadataKey([e.testDate, e.labName]) : null
  ).map((files) => ({
    id: newClientId(),
    files,
    ...buildGroupMeta(files),
  }));

  return [...next, ...newGroups];
}

export function BulkUploadBloodTests({ patientId, onSuccess, onCancel }: BulkUploadBloodTestsProps) {
  const [groups, setGroups] = useState<BloodGroup[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshGroupMeta = (gs: BloodGroup[]): BloodGroup[] =>
    gs.map((g) => ({ ...g, ...buildGroupMeta(g.files) }));

  const parseAndGroup = useCallback(async (files: File[]) => {
    const placeholders: BloodFileEntry[] = files.map((file) => ({
      clientId: newClientId(),
      file,
      parsing: true,
    }));

    setGroups((prev) => [
      ...prev,
      ...placeholders.map((p) => ({
        id: newClientId(),
        files: [p],
        ...buildGroupMeta([]),
      })),
    ]);
    setIsParsing(true);

    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("mode", "individual");
      const res = await fetch("/api/blood-tests/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      type ParsedBloodFile = {
        fileName: string;
        rawText: string;
        markers: ParsedBloodMarker[];
        testDate: string | null;
        labName: string | null;
        warning?: string;
      };
      const parsedByName = new Map<string, ParsedBloodFile>(
        (data.files ?? []).map(
          (p: ParsedBloodFile): [string, ParsedBloodFile] => [p.fileName, p]
        )
      );

      setGroups((prev) => {
        const parsedNew: BloodFileEntry[] = placeholders.map((entry) => {
          const parsed = parsedByName.get(entry.file.name);
          if (!parsed) {
            return { ...entry, parsing: false, parseError: "Failed to parse" };
          }
          return {
            ...entry,
            parsing: false,
            rawText: parsed.rawText,
            markers: parsed.markers,
            testDate: parsed.testDate,
            labName: parsed.labName,
            warning: parsed.warning,
          };
        });

        const existing = prev
          .map((g) => ({
            ...g,
            files: g.files.filter((f) => !f.parsing),
          }))
          .filter((g) => g.files.length > 0);

        return mergeNewFilesIntoGroups(existing, parsedNew);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse files");
      setGroups((prev) =>
        refreshGroupMeta(
          prev.map((g) => ({
            ...g,
            files: g.files.map((f) =>
              f.parsing ? { ...f, parsing: false, parseError: "Parse failed" } : f
            ),
          }))
        )
      );
    } finally {
      setIsParsing(false);
    }
  }, []);

  function updateGroup(groupId: string, patch: Partial<BloodGroup>) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  }

  function removeFile(groupId: string, clientId: string) {
    setGroups((prev) => {
      const next = refreshGroupMeta(
        prev
          .map((g) =>
            g.id === groupId ? { ...g, files: g.files.filter((f) => f.clientId !== clientId) } : g
          )
          .filter((g) => g.files.length > 0)
      );
      return next.length ? next : [{ id: newClientId(), files: [], ...buildGroupMeta([]) }];
    });
  }

  function moveFile(fromGroupId: string, clientId: string, toGroupId: string) {
    if (fromGroupId === toGroupId) return;
    setGroups((prev) => {
      let moved: BloodFileEntry | undefined;
      const without = prev.map((g) => {
        if (g.id !== fromGroupId) return g;
        moved = g.files.find((f) => f.clientId === clientId);
        return { ...g, files: g.files.filter((f) => f.clientId !== clientId) };
      });
      if (!moved) return prev;
      return refreshGroupMeta(
        without
          .map((g) =>
            g.id === toGroupId ? { ...g, files: sortFilesByPage([...g.files, moved!]) } : g
          )
          .filter((g) => g.files.length > 0)
      );
    });
  }

  function reorderFile(groupId: string, clientId: string, direction: "up" | "down") {
    setGroups((prev) =>
      refreshGroupMeta(
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
      )
    );
  }

  function addGroup() {
    setGroups((prev) => [...prev, { id: newClientId(), files: [], ...buildGroupMeta([]) }]);
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => {
      const target = prev.find((g) => g.id === groupId);
      if (!target) return prev;
      const rest = prev.filter((g) => g.id !== groupId);
      if (rest.length === 0) {
        return refreshGroupMeta([{ id: newClientId(), files: target.files, ...buildGroupMeta(target.files) }]);
      }
      if (target.files.length === 0) return rest;
      return refreshGroupMeta(
        rest.map((g, i) =>
          i === 0 ? { ...g, files: sortFilesByPage([...target.files, ...g.files]) } : g
        )
      );
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validGroups = groups.filter((g) => g.files.length > 0);
    if (!validGroups.length) {
      setError("Add at least one file");
      return;
    }

    setIsSubmitting(true);
    const savedGroupIds: string[] = [];

    try {
      for (const group of validGroups) {
        const filePaths: string[] = [];
        for (const entry of group.files) {
          await assertFileReadable(entry.file);

          const fd = new FormData();
          fd.append("file", entry.file);
          fd.append("type", "bloodtest");
          fd.append("patientId", patientId);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
          if (!uploadRes.ok) {
            throw new Error(
              await readApiError(uploadRes, `Failed to upload "${entry.file.name}"`)
            );
          }
          const uploadData = await uploadRes.json();
          if (uploadData.data?.path) filePaths.push(uploadData.data.path);
        }

        const markers = prepareBloodMarkersForSave(
          mergeBloodMarkers(group.files.map((f) => f.markers ?? []))
        );

        const rawText = combineTexts(group.files.map((f) => f.rawText));

        const res = await fetch("/api/blood-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            testDate: group.testDate,
            labName: group.labName || undefined,
            requestingPhysician: group.requestingPhysician || undefined,
            markers,
            rawText: rawText || undefined,
            filePath: filePaths.length ? JSON.stringify(filePaths) : undefined,
          }),
        });
        if (!res.ok) {
          throw new Error(
            await readApiError(res, `Failed to save blood test (${group.testDate})`)
          );
        }

        savedGroupIds.push(group.id);
      }

      onSuccess?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error saving blood tests";
      if (savedGroupIds.length > 0) {
        setGroups((prev) => prev.filter((g) => !savedGroupIds.includes(g.id)));
        setError(
          `${savedGroupIds.length} blood test${savedGroupIds.length !== 1 ? "s" : ""} saved. ${message}`
        );
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayGroups = groups.length ? groups : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <BulkFileGrouper<BloodFileEntry, BloodGroup>
        groups={displayGroups}
        accept={{
          "application/pdf": [".pdf"],
          "text/plain": [".txt"],
          "text/csv": [".csv"],
          "image/jpeg": [".jpg", ".jpeg"],
          "image/png": [".png"],
        }}
        dropLabel="Drop blood test files (PDF, TXT, CSV, JPG, PNG)"
        isProcessing={isParsing}
        onFilesAdded={parseAndGroup}
        onRemoveFile={removeFile}
        onMoveFile={moveFile}
        onReorderFile={reorderFile}
        onAddGroup={addGroup}
        onRemoveGroup={removeGroup}
        renderGroupHeader={(group) => (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">Test date</label>
              <input
                type="date"
                value={group.testDate}
                onChange={(e) => updateGroup(group.id, { testDate: e.target.value })}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Laboratory</label>
              <input
                type="text"
                value={group.labName}
                onChange={(e) => updateGroup(group.id, { labName: e.target.value })}
                placeholder="Lab name"
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Markers extracted</label>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1 mt-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-blue-500" />
                {group.markerCount}
              </p>
            </div>
          </div>
        )}
        renderFileExtra={(file) => (
          <>
            {file.warning && <p className="text-xs text-amber-600">{file.warning}</p>}
            {file.markers && file.markers.length > 0 && (
              <p className="text-xs text-slate-400">{file.markers.length} markers on this page</p>
            )}
          </>
        )}
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
          Save {groups.filter((g) => g.files.length > 0).length || ""} Blood Test
          {groups.filter((g) => g.files.length > 0).length !== 1 ? "s" : ""}
        </Button>
      </div>
    </form>
  );
}
