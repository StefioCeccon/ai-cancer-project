"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Pill, Plus, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { UploadTherapy } from "@/components/therapies/UploadTherapy";
import { BloodTestSourceFiles } from "@/components/blood-tests/BloodTestSourceFiles";
import { formatDate, formatDateShort } from "@ai-cancer-project/shared";
import type { Therapy, TherapyType } from "@ai-cancer-project/shared";
import { usePatient } from "@/contexts/PatientContext";

const THERAPY_LABELS: Record<TherapyType, string> = {
  chemotherapy: "Chemotherapy",
  immunotherapy: "Immunotherapy",
  radiation: "Radiation",
  surgery: "Surgery",
  targeted_therapy: "Targeted Therapy",
  hormone_therapy: "Hormone Therapy",
  supportive_care: "Supportive Care",
  other: "Other",
};

function formatDateRange(start: string, end?: string | null): string {
  if (!end) return `${formatDate(start)} → ongoing`;
  return `${formatDate(start)} → ${formatDate(end)}`;
}

function trunc(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

interface TherapyRecord extends Therapy {
  medications: NonNullable<Therapy["medications"]>;
}

export default function TherapiesPage() {
  const { selectedPatientId } = usePatient();
  const [therapies, setTherapies] = useState<TherapyRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTherapies = useCallback((patientId: string) => {
    if (!patientId) { setTherapies([]); return; }
    setLoading(true);
    fetch(`/api/therapies?patientId=${patientId}`)
      .then((r) => r.json())
      .then((d) => setTherapies(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setShowUpload(false);
    setEditingId(null);
    loadTherapies(selectedPatientId);
  }, [selectedPatientId, loadTherapies]);

  const sorted = useMemo(
    () =>
      [...therapies].sort((a, b) => {
        const aOngoing = !a.endDate ? 0 : 1;
        const bOngoing = !b.endDate ? 0 : 1;
        if (aOngoing !== bOngoing) return aOngoing - bOngoing;
        return b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id);
      }),
    [therapies]
  );

  const activeCount = useMemo(() => sorted.filter((t) => !t.endDate).length, [sorted]);

  function handleSuccess() {
    setShowUpload(false);
    setEditingId(null);
    loadTherapies(selectedPatientId);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/therapies/${id}`, { method: "DELETE" });
    setDeletingId(null);
    loadTherapies(selectedPatientId);
  }

  return (
    <AppShell title="Therapies">
      <div className="space-y-5">
        {selectedPatientId && !editingId && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowUpload((v) => !v)}>
              <Plus className="w-4 h-4" /> Add Therapy
            </Button>
          </div>
        )}

        {!selectedPatientId && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500 text-sm">
              Select a patient from the header to view therapies.
            </CardContent>
          </Card>
        )}

        {showUpload && selectedPatientId && !editingId && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-800">Add Therapies</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter manually or import prescriptions and treatment plans — include dosage, frequency, and attached medications.
              </p>
            </CardHeader>
            <CardContent>
              <UploadTherapy
                patientId={selectedPatientId}
                onSuccess={handleSuccess}
                onCancel={() => setShowUpload(false)}
              />
            </CardContent>
          </Card>
        )}

        {selectedPatientId && sorted.length > 0 && !editingId && (
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-800">Treatment Summary</h3></CardHeader>
            <CardContent className="flex gap-4 text-sm">
              <span className="text-slate-600">{sorted.length} total regimen{sorted.length === 1 ? "" : "s"}</span>
              {activeCount > 0 && (
                <Badge variant="warning">{activeCount} active</Badge>
              )}
            </CardContent>
          </Card>
        )}

        {selectedPatientId && loading && <div className="text-center py-8 text-slate-400">Loading...</div>}

        {selectedPatientId && !loading && sorted.length === 0 && !showUpload && (
          <Card>
            <CardContent className="py-12 text-center">
              <Pill className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No therapies recorded yet</p>
              <p className="text-slate-400 text-sm mt-1">Add manually or import treatment documents to reconstruct therapy history over time.</p>
            </CardContent>
          </Card>
        )}

        {selectedPatientId && sorted.map((therapy) => (
          <Card key={therapy.id}>
            {editingId === therapy.id ? (
              <>
                <CardHeader><h3 className="font-semibold text-slate-800">Edit Therapy</h3></CardHeader>
                <CardContent>
                  <UploadTherapy
                    patientId={selectedPatientId}
                    initialData={{
                      ...therapy,
                      medications: (therapy.medications ?? []).map((m) => ({
                        name: m.name,
                        startDate: m.startDate ?? "",
                        dosage: m.dosage ?? "",
                        frequency: m.frequency ?? "",
                        route: m.route ?? "",
                        notes: m.notes ?? "",
                      })),
                    }}
                    onSuccess={handleSuccess}
                    onCancel={() => setEditingId(null)}
                  />
                </CardContent>
              </>
            ) : (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full px-6 py-4 flex items-start justify-between hover:bg-slate-50 transition-colors rounded-xl cursor-pointer"
                  onClick={() => setExpandedId(expandedId === therapy.id ? null : therapy.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedId(expandedId === therapy.id ? null : therapy.id); }}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <Pill className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-left min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-800">{therapy.name}</p>
                        <Badge variant="neutral">{THERAPY_LABELS[therapy.therapyType]}</Badge>
                        {!therapy.endDate && <Badge variant="warning">active</Badge>}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{formatDateRange(therapy.startDate, therapy.endDate)}</p>
                      {therapy.medications?.length > 0 && (() => {
                        // Show latest dosage per unique drug name
                        const latest = new Map<string, typeof therapy.medications[0]>();
                        for (const m of [...therapy.medications].sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))) {
                          latest.set(m.name.toLowerCase().trim(), m);
                        }
                        const parts = [...latest.values()].map((m) =>
                          m.dosage ? `${m.name} ${m.dosage}` : m.name
                        );
                        return (
                          <p className="text-xs text-slate-400 mt-1">{trunc(parts.join(" · "), 80)}</p>
                        );
                      })()}
                      {therapy.notes && (
                        <p className="text-xs text-slate-400 italic mt-0.5">{trunc(therapy.notes, 80)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4 mt-0.5">
                    <BloodTestSourceFiles filePath={therapy.filePath} />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingId(therapy.id); setShowUpload(false); setExpandedId(null); }}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      title="Edit therapy"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {deletingId === therapy.id ? (
                      <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleDelete(therapy.id)}
                          className="text-xs px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeletingId(therapy.id); }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete therapy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {expandedId === therapy.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
                {expandedId === therapy.id && (
                  <CardContent className="pt-0 space-y-3 text-sm">
                    {(therapy.dosage || therapy.frequency) && (
                      <div className="flex flex-wrap gap-4 text-slate-600">
                        {therapy.dosage && <span><span className="text-slate-400">Dosage:</span> {therapy.dosage}</span>}
                        {therapy.frequency && <span><span className="text-slate-400">Frequency:</span> {therapy.frequency}</span>}
                      </div>
                    )}
                    {therapy.sourceTitle && <p><span className="text-slate-400">Source:</span> {therapy.sourceTitle}</p>}
                    {therapy.notes && <p>{therapy.notes}</p>}
                    {therapy.medications?.length > 0 && (() => {
                      // Group by drug name, sorted by startDate within each group
                      const byDrug = new Map<string, typeof therapy.medications>();
                      for (const m of therapy.medications) {
                        const key = m.name.toLowerCase().trim();
                        if (!byDrug.has(key)) byDrug.set(key, []);
                        byDrug.get(key)!.push(m);
                      }
                      for (const entries of byDrug.values()) {
                        entries.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
                      }
                      return (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-2">Medications</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-100">
                                  <th className="text-left py-1.5 pr-3">Name</th>
                                  <th className="text-left py-1.5 pr-3">From</th>
                                  <th className="text-left py-1.5 pr-3">Dosage</th>
                                  <th className="text-left py-1.5 pr-3">Frequency</th>
                                  <th className="text-left py-1.5 pr-3">Route</th>
                                  <th className="text-left py-1.5">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...byDrug.values()].map((entries) =>
                                  entries.map((m, idx) => (
                                    <tr key={m.id ?? `${m.name}-${idx}`} className="border-b border-slate-50">
                                      <td className="py-1.5 pr-3 font-medium text-slate-700">
                                        {idx === 0 ? m.name : ""}
                                      </td>
                                      <td className="py-1.5 pr-3 text-slate-500">
                                        {m.startDate ? formatDateShort(m.startDate) : "—"}
                                        {entries.length > 1 && idx < entries.length - 1 && (
                                          <span className="ml-1 text-amber-500" title="dose changed">↑</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-3 text-slate-600">{m.dosage ?? "—"}</td>
                                      <td className="py-1.5 pr-3 text-slate-600">{m.frequency ?? "—"}</td>
                                      <td className="py-1.5 pr-3 text-slate-600">{m.route ?? "—"}</td>
                                      <td className="py-1.5 text-slate-500 italic">{m.notes ? trunc(m.notes, 60) : "—"}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                )}
              </>
            )}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
