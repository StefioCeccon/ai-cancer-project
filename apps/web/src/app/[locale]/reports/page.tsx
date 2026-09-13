"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, Plus, ChevronRight, Link2, Link2Off, Pencil, Trash2, Search, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { UploadReport } from "@/components/reports/UploadReport";
import { BulkUploadReports } from "@/components/reports/BulkUploadReports";
import { BloodTestSourceFiles } from "@/components/blood-tests/BloodTestSourceFiles";
import { StoredDocumentViewer } from "@/components/upload/StoredDocumentViewer";
import { ReportTimelineCategoryField } from "@/components/reports/ReportTimelineCategoryField";
import { isTimelineCategoryManual } from "@/lib/timeline/timelineCategoryOptions";
import { formatDate } from "@cancer-monitor/shared";
import type { ReportType } from "@cancer-monitor/shared";
import { usePatient } from "@/contexts/PatientContext";
import { readApiError } from "@/lib/upload/readApiError";

const typeColors: Record<ReportType, "default" | "info" | "warning" | "success" | "neutral"> = {
  visit_note: "default",
  pathology: "danger" as "default",
  radiology: "info",
  discharge_summary: "neutral",
  treatment_plan: "success",
  prescription: "warning",
  referral: "neutral",
  other: "neutral",
};

const typeLabels: Record<ReportType, string> = {
  visit_note: "Visit Note",
  pathology: "Pathology",
  radiology: "Radiology",
  discharge_summary: "Discharge",
  treatment_plan: "Treatment Plan",
  prescription: "Prescription",
  referral: "Referral",
  other: "Other",
};

interface ReportRecord {
  id: string;
  patientId: string;
  imagingStudyId?: string | null;
  reportType: ReportType;
  reportDate: string;
  author?: string | null;
  institution?: string | null;
  title: string;
  rawText?: string | null;
  aiSummary?: string | null;
  filePath?: string | null;
  clinicalSpecialty?: string | null;
  extractedData?: { timelineCategoryManual?: boolean } | null;
  linkedStudyModality?: string | null;
  linkedStudyDate?: string | null;
  linkedStudyBodyPart?: string | null;
}

export default function ReportsPage() {
  const { selectedPatientId } = usePatient();
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<"single" | "bulk">("single");
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ReportType | "">("");

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      if (typeFilter && r.reportType !== typeFilter) return false;
      if (!q) return true;
      const fields = [
        r.title,
        r.author,
        r.institution,
        r.aiSummary,
        typeLabels[r.reportType],
        r.linkedStudyModality,
        r.linkedStudyBodyPart,
        r.rawText,
      ];
      return fields.some((f) => f?.toLowerCase().includes(q));
    });
  }, [reports, searchQuery, typeFilter]);

  async function unlinkStudy(reportId: string) {
    await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagingStudyId: null }),
    });
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? { ...r, imagingStudyId: null, linkedStudyModality: null, linkedStudyDate: null, linkedStudyBodyPart: null }
          : r
      )
    );
    if (selectedReport?.id === reportId) {
      setSelectedReport((prev) => prev ? { ...prev, imagingStudyId: null, linkedStudyModality: null, linkedStudyDate: null, linkedStudyBodyPart: null } : prev);
    }
  }

  const loadReports = useCallback((patientId: string) => {
    if (!patientId) { setReports([]); return; }
    setLoading(true);
    fetch(`/api/reports?patientId=${patientId}`)
      .then((r) => r.json())
      .then((d) => setReports((d.data ?? []).sort((a: ReportRecord, b: ReportRecord) => b.reportDate.localeCompare(a.reportDate))))
      .finally(() => setLoading(false));
  }, []);

  function handleSuccess() {
    const keepSelectedId = editingReportId ?? selectedReport?.id ?? null;
    setShowUpload(false);
    setEditingReportId(null);
    if (!selectedPatientId) return;
    setLoading(true);
    fetch(`/api/reports?patientId=${selectedPatientId}`)
      .then((r) => r.json())
      .then((d) => {
        const nextReports = (d.data ?? []).sort((a: ReportRecord, b: ReportRecord) =>
          b.reportDate.localeCompare(a.reportDate)
        );
        setReports(nextReports);
        if (keepSelectedId) {
          setSelectedReport(nextReports.find((r: ReportRecord) => r.id === keepSelectedId) ?? null);
        }
      })
      .finally(() => setLoading(false));
  }

  async function deleteReport(report: ReportRecord) {
    const confirmed = window.confirm(`Delete "${report.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setError(null);
    setDeletingId(report.id);
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to delete report"));
      }
      if (selectedReport?.id === report.id) setSelectedReport(null);
      if (editingReportId === report.id) setEditingReportId(null);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete report");
    } finally {
      setDeletingId(null);
    }
  }

  const editingReport = editingReportId ? reports.find((r) => r.id === editingReportId) ?? null : null;

  useEffect(() => {
    setSelectedReport(null);
    setShowUpload(false);
    setUploadMode("single");
    setEditingReportId(null);
    setError(null);
    setSearchQuery("");
    setTypeFilter("");
    loadReports(selectedPatientId);
  }, [selectedPatientId, loadReports]);

  return (
    <AppShell title="Medical Reports">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {error && (
          <div className="lg:col-span-3 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* Left: list */}
        <div className="space-y-4">
          {selectedPatientId && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowUpload((v) => !v)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}

          {!selectedPatientId && (
            <div className="text-center py-12 text-slate-500 text-sm">
              Select a patient from the header to view reports.
            </div>
          )}

          {selectedPatientId && loading && <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>}

          {selectedPatientId && !loading && reports.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No reports yet</p>
            </div>
          )}

          {selectedPatientId && !loading && reports.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reports..."
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ReportType | "")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600"
              >
                <option value="">All types</option>
                {(Object.keys(typeLabels) as ReportType[]).map((type) => (
                  <option key={type} value={type}>{typeLabels[type]}</option>
                ))}
              </select>
            </div>
          )}

          {selectedPatientId && !loading && reports.length > 0 && filteredReports.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No reports match your search</p>
            </div>
          )}

          <div className="space-y-2">
            {selectedPatientId && filteredReports.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedReport(r); setShowUpload(false); setEditingReportId(null); }}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedReport?.id === r.id && !editingReportId
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-blue-300 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(r.reportDate)}</p>
                    {r.author && <p className="text-xs text-slate-400">{r.author}</p>}
                    {r.linkedStudyModality && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                        <Link2 className="w-2.5 h-2.5" />
                        {r.linkedStudyModality} · {r.linkedStudyDate ? formatDate(r.linkedStudyDate) : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={typeColors[r.reportType] as "default"}>{typeLabels[r.reportType]}</Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: detail, edit, or upload */}
        <div className="lg:col-span-2">
          {showUpload && selectedPatientId && !editingReportId && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-800">
                    {uploadMode === "bulk" ? "Bulk Upload Reports" : "Upload Report"}
                  </h3>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setUploadMode("single")}
                      className={`px-3 py-1.5 ${uploadMode === "single" ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      Single
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("bulk")}
                      className={`px-3 py-1.5 ${uploadMode === "bulk" ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      Bulk
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {uploadMode === "bulk" ? (
                  <BulkUploadReports
                    patientId={selectedPatientId}
                    onSuccess={handleSuccess}
                    onCancel={() => setShowUpload(false)}
                  />
                ) : (
                  <UploadReport
                    patientId={selectedPatientId}
                    onSuccess={handleSuccess}
                    onCancel={() => setShowUpload(false)}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {editingReport && selectedPatientId && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-800">Edit Report</h3>
              </CardHeader>
              <CardContent>
                <UploadReport
                  patientId={selectedPatientId}
                  initialData={{
                    reportId: editingReport.id,
                    title: editingReport.title,
                    reportType: editingReport.reportType,
                    reportDate: editingReport.reportDate,
                    author: editingReport.author,
                    institution: editingReport.institution,
                    rawText: editingReport.rawText,
                    aiSummary: editingReport.aiSummary,
                    filePath: editingReport.filePath,
                  }}
                  onSuccess={handleSuccess}
                  onCancel={() => setEditingReportId(null)}
                />
              </CardContent>
            </Card>
          )}

          {selectedReport && !showUpload && !editingReportId && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{selectedReport.title}</h3>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={typeColors[selectedReport.reportType] as "default"}>
                        {typeLabels[selectedReport.reportType]}
                      </Badge>
                      <span className="text-xs text-slate-500">{formatDate(selectedReport.reportDate)}</span>
                    </div>
                    {selectedReport.author && (
                      <p className="text-sm text-slate-500 mt-1">
                        {selectedReport.author}
                        {selectedReport.institution && ` · ${selectedReport.institution}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <BloodTestSourceFiles filePath={selectedReport.filePath} />
                    <button
                      type="button"
                      onClick={() => {
                        setEditingReportId(selectedReport.id);
                        setShowUpload(false);
                      }}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      title="Edit report"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReport(selectedReport)}
                      disabled={deletingId === selectedReport.id}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Delete report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReportTimelineCategoryField
                  reportId={selectedReport.id}
                  title={selectedReport.title}
                  clinicalSpecialty={selectedReport.clinicalSpecialty}
                  timelineCategoryManual={isTimelineCategoryManual(selectedReport.extractedData)}
                  onUpdated={(clinicalSpecialty, manual) => {
                    setSelectedReport((prev) =>
                      prev ? { ...prev, clinicalSpecialty, extractedData: { timelineCategoryManual: manual } } : prev
                    );
                    setReports((prev) =>
                      prev.map((r) =>
                        r.id === selectedReport.id
                          ? { ...r, clinicalSpecialty, extractedData: { timelineCategoryManual: manual } }
                          : r
                      )
                    );
                  }}
                />

                {selectedReport.linkedStudyModality && (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-blue-700">Linked Imaging Study</p>
                        <p className="text-xs text-slate-600">
                          {selectedReport.linkedStudyModality}
                          {selectedReport.linkedStudyBodyPart ? ` · ${selectedReport.linkedStudyBodyPart}` : ""}
                          {selectedReport.linkedStudyDate ? ` · ${formatDate(selectedReport.linkedStudyDate)}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => unlinkStudy(selectedReport.id)}
                      title="Unlink"
                      className="text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <Link2Off className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {selectedReport.aiSummary && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="text-xs font-semibold text-blue-700 mb-1">AI Summary</p>
                    <p className="text-sm text-slate-700">{selectedReport.aiSummary}</p>
                  </div>
                )}
                {selectedReport.rawText && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Report Text</p>
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {selectedReport.rawText}
                    </pre>
                  </div>
                )}
                <StoredDocumentViewer filePath={selectedReport.filePath} />
              </CardContent>
            </Card>
          )}

          {!selectedReport && !showUpload && !editingReportId && (
            <div className="h-full flex items-center justify-center text-slate-300 text-sm py-24">
              Select a report to view details
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
