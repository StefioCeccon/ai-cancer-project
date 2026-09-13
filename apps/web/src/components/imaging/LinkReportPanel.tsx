"use client";

import { useState } from "react";
import { Link2, Link2Off, Plus, FileText, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@cancer-monitor/shared";

interface LinkedReport {
  id: string;
  title: string;
  reportType: string;
  reportDate: string;
  author?: string | null;
}

interface AvailableReport extends LinkedReport {
  imagingStudyId?: string | null;
}

interface Props {
  studyId: string;
  patientId: string;
  initialLinkedReports: LinkedReport[];
}

export function LinkReportPanel({ studyId, patientId, initialLinkedReports }: Props) {
  const [linked, setLinked] = useState<LinkedReport[]>(initialLinkedReports);
  const [available, setAvailable] = useState<AvailableReport[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  async function openPicker() {
    if (showPicker) { setShowPicker(false); return; }
    const res = await fetch(`/api/reports?patientId=${patientId}`);
    const data = await res.json();
    const linkedIds = new Set(linked.map((r) => r.id));
    setAvailable((data.data ?? []).filter((r: AvailableReport) => !linkedIds.has(r.id)));
    setShowPicker(true);
  }

  async function link(report: AvailableReport) {
    setBusy(true);
    const res = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagingStudyId: studyId }),
    });
    if (res.ok) {
      setLinked((prev) => [...prev, report]);
      setAvailable((prev) => prev.filter((r) => r.id !== report.id));
      setShowPicker(false);
    }
    setBusy(false);
  }

  async function unlink(reportId: string) {
    setBusy(true);
    await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagingStudyId: null }),
    });
    setLinked((prev) => prev.filter((r) => r.id !== reportId));
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-slate-400" />
          Linked Reports
        </h4>
        <Button size="sm" variant="ghost" onClick={openPicker} disabled={busy}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          Link
          <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showPicker ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* picker dropdown */}
      {showPicker && (
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
          {available.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-3 text-center">
              No unlinked reports for this patient
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
              {available.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => link(r)}
                    disabled={busy}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-start gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{r.title}</p>
                      <p className="text-xs text-slate-400">{formatDate(r.reportDate)}{r.author ? ` · ${r.author}` : ""}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* linked list */}
      {linked.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No reports linked to this study yet.</p>
      ) : (
        <ul className="space-y-2">
          {linked.map((r) => (
            <li key={r.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
              <FileText className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{r.title}</p>
                <p className="text-xs text-slate-500">{formatDate(r.reportDate)}{r.author ? ` · ${r.author}` : ""}</p>
                <Badge variant="info" className="mt-1 text-[10px]">{r.reportType.replace("_", " ")}</Badge>
              </div>
              <button
                onClick={() => unlink(r.id)}
                disabled={busy}
                title="Unlink report"
                className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
              >
                <Link2Off className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
