"use client";

import { useState, useRef, useEffect } from "react";
import { FileText } from "lucide-react";
import { parseStoredFilePaths } from "@/lib/upload/parseStoredFilePaths";

interface BloodTestSourceFilesProps {
  filePath?: string | null;
}

export function BloodTestSourceFiles({ filePath }: BloodTestSourceFilesProps) {
  const paths = parseStoredFilePaths(filePath);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (paths.length === 0) return null;

  function openPath(path: string) {
    window.open(path, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  if (paths.length === 1) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openPath(paths[0]);
        }}
        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        title="View original document"
      >
        <FileText className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        title={`View original documents (${paths.length} pages)`}
      >
        <FileText className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-slate-200 bg-white shadow-lg py-1">
          {paths.map((path, index) => (
            <button
              key={path}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPath(path);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              Page {index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
