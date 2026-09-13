"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, X, ChevronUp, ChevronDown, FolderPlus, Layers, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";

export interface GroupedFileEntry {
  clientId: string;
  file: File;
  parsing?: boolean;
  parseError?: string;
}

export interface FileGroup<T extends GroupedFileEntry> {
  id: string;
  files: T[];
}

interface BulkFileGrouperProps<T extends GroupedFileEntry, G extends FileGroup<T> = FileGroup<T>> {
  groups: G[];
  accept: Record<string, string[]>;
  dropLabel: string;
  isProcessing?: boolean;
  onFilesAdded: (files: File[]) => void;
  onRemoveFile: (groupId: string, clientId: string) => void;
  onMoveFile: (fromGroupId: string, clientId: string, toGroupId: string) => void;
  onReorderFile: (groupId: string, clientId: string, direction: "up" | "down") => void;
  onAddGroup: () => void;
  onRemoveGroup: (groupId: string) => void;
  renderGroupHeader: (group: G, index: number) => React.ReactNode;
  renderFileExtra?: (file: T) => React.ReactNode;
}

export function BulkFileGrouper<T extends GroupedFileEntry, G extends FileGroup<T> = FileGroup<T>>({
  groups,
  accept,
  dropLabel,
  isProcessing,
  onFilesAdded,
  onRemoveFile,
  onMoveFile,
  onReorderFile,
  onAddGroup,
  onRemoveGroup,
  renderGroupHeader,
  renderFileExtra,
}: BulkFileGrouperProps<T, G>) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length) onFilesAdded(accepted);
    },
    [onFilesAdded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: true,
    disabled: isProcessing,
  });

  const totalFiles = groups.reduce((n, g) => n + g.files.length, 0);

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300",
          isProcessing && "opacity-60 pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-medium">
          {isProcessing ? "Parsing files with AI..." : dropLabel}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Drop many files at once — pages of the same document are grouped automatically
        </p>
      </div>

      {totalFiles > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            <Layers className="w-3.5 h-3.5 inline mr-1" />
            {totalFiles} file{totalFiles !== 1 ? "s" : ""} in {groups.length} group{groups.length !== 1 ? "s" : ""}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={onAddGroup}>
            <FolderPlus className="w-3.5 h-3.5" /> New group
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group, index) => (
          <div key={group.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Group {index + 1} · {group.files.length} file{group.files.length !== 1 ? "s" : ""}
                  </p>
                  {renderGroupHeader(group, index)}
                </div>
                {groups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveGroup(group.id)}
                    className="text-slate-400 hover:text-red-500 p-1"
                    title="Remove group"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {group.files.length === 0 ? (
              <p className="text-xs text-slate-400 px-4 py-3">No files — move files here or drop new ones</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {group.files.map((entry, fileIndex) => (
                  <li key={entry.clientId} className="flex items-center gap-2 px-3 py-2">
                    <GripVertical className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{entry.file.name}</p>
                      {entry.parsing && <p className="text-xs text-blue-500">Parsing...</p>}
                      {entry.parseError && <p className="text-xs text-red-500">{entry.parseError}</p>}
                      {renderFileExtra?.(entry)}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        disabled={fileIndex === 0}
                        onClick={() => onReorderFile(group.id, entry.clientId, "up")}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        title="Move up (page order)"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={fileIndex === group.files.length - 1}
                        onClick={() => onReorderFile(group.id, entry.clientId, "down")}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        title="Move down (page order)"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {groups.length > 1 && (
                        <select
                          value={group.id}
                          onChange={(e) => onMoveFile(group.id, entry.clientId, e.target.value)}
                          className="text-xs border border-slate-200 rounded px-1 py-0.5 max-w-[90px]"
                          title="Move to group"
                        >
                          {groups.map((g, gi) => (
                            <option key={g.id} value={g.id}>
                              Group {gi + 1}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveFile(group.id, entry.clientId)}
                        className="p-1 text-slate-400 hover:text-red-500"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function newClientId(): string {
  return crypto.randomUUID();
}
