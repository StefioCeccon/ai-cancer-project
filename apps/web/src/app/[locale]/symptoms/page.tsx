"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { HeartPulse, Plus, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { UploadSymptom } from "@/components/symptoms/UploadSymptom";
import { BloodTestSourceFiles } from "@/components/blood-tests/BloodTestSourceFiles";
import { formatDate } from "@ai-cancer-project/shared";
import type { Symptom, SymptomSeverity } from "@ai-cancer-project/shared";
import { usePatient } from "@/contexts/PatientContext";

const SEVERITY_VARIANT: Record<SymptomSeverity, "neutral" | "warning" | "danger"> = {
  mild: "neutral",
  moderate: "warning",
  severe: "danger",
};

function formatDateRange(start: string, end?: string | null): string {
  if (!end) return `${formatDate(start)} → ongoing`;
  return `${formatDate(start)} → ${formatDate(end)}`;
}

export default function SymptomsPage() {
  const { selectedPatientId } = usePatient();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSymptoms = useCallback((patientId: string) => {
    if (!patientId) { setSymptoms([]); return; }
    setLoading(true);
    fetch(`/api/symptoms?patientId=${patientId}`)
      .then((r) => r.json())
      .then((d) => setSymptoms(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setShowUpload(false);
    setEditingId(null);
    loadSymptoms(selectedPatientId);
  }, [selectedPatientId, loadSymptoms]);

  // Within each group: ongoing first, then most recent start date
  const sorted = useMemo(
    () =>
      [...symptoms].sort((a, b) => {
        const aOngoing = !a.endDate ? 0 : 1;
        const bOngoing = !b.endDate ? 0 : 1;
        if (aOngoing !== bOngoing) return aOngoing - bOngoing;
        return b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id);
      }),
    [symptoms]
  );

  // Group by canonical name, preserving sort order of first occurrence
  const groups = useMemo(() => {
    const map = new Map<string, Symptom[]>();
    for (const s of sorted) {
      const key = s.name.toLowerCase().trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // Sort groups: groups with any ongoing entry first, then by most recent startDate
    return [...map.values()].sort((a, b) => {
      const aOngoing = a.some((s) => !s.endDate) ? 0 : 1;
      const bOngoing = b.some((s) => !s.endDate) ? 0 : 1;
      if (aOngoing !== bOngoing) return aOngoing - bOngoing;
      return b[0].startDate.localeCompare(a[0].startDate);
    });
  }, [sorted]);

  function handleSuccess() {
    setShowUpload(false);
    setEditingId(null);
    loadSymptoms(selectedPatientId);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/symptoms/${id}`, { method: "DELETE" });
    setDeletingId(null);
    loadSymptoms(selectedPatientId);
  }

  const isEditing = editingId !== null;

  return (
    <AppShell title="Symptoms">
      <div className="space-y-5">
        {selectedPatientId && !isEditing && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowUpload((v) => !v)}>
              <Plus className="w-4 h-4" /> Add Symptom
            </Button>
          </div>
        )}

        {!selectedPatientId && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500 text-sm">
              Select a patient from the header to view symptoms.
            </CardContent>
          </Card>
        )}

        {showUpload && selectedPatientId && !isEditing && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-800">Add Symptoms</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter manually or import a document — symptoms can be point-in-time events or span a date range.
              </p>
            </CardHeader>
            <CardContent>
              <UploadSymptom
                patientId={selectedPatientId}
                onSuccess={handleSuccess}
                onCancel={() => setShowUpload(false)}
              />
            </CardContent>
          </Card>
        )}

        {selectedPatientId && loading && <div className="text-center py-8 text-slate-400">Loading...</div>}

        {selectedPatientId && !loading && sorted.length === 0 && !showUpload && (
          <Card>
            <CardContent className="py-12 text-center">
              <HeartPulse className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No symptoms recorded yet</p>
              <p className="text-slate-400 text-sm mt-1">Add manually or import visit notes to reconstruct symptom history over time.</p>
            </CardContent>
          </Card>
        )}

        {selectedPatientId && !loading && groups.map((entries) => {
          const name = entries[0].name;
          const hasOngoing = entries.some((s) => !s.endDate);

          return (
            <div key={name.toLowerCase().trim()} className="space-y-2">
              {/* Group header */}
              {!isEditing && (
                <div className="flex items-center gap-3 px-1 pt-1">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-600 capitalize">{name}</span>
                  {hasOngoing && <Badge variant="warning">ongoing</Badge>}
                  <span className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{entries.length} episode{entries.length === 1 ? "" : "s"}</span>
                </div>
              )}

              {entries.map((symptom) => (
                <Card key={symptom.id}>
                  {editingId === symptom.id ? (
                    <>
                      <CardHeader><h3 className="font-semibold text-slate-800">Edit Symptom</h3></CardHeader>
                      <CardContent>
                        <UploadSymptom
                          patientId={selectedPatientId}
                          initialData={symptom}
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
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl cursor-pointer"
                        onClick={() => setExpandedId(expandedId === symptom.id ? null : symptom.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedId(expandedId === symptom.id ? null : symptom.id); }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <p className="text-sm text-slate-500">{formatDateRange(symptom.startDate, symptom.endDate)}</p>
                          </div>
                          {symptom.severity && (
                            <Badge variant={SEVERITY_VARIANT[symptom.severity]}>{symptom.severity}</Badge>
                          )}
                          {!symptom.endDate && !symptom.severity && (
                            <Badge variant="warning">ongoing</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <BloodTestSourceFiles filePath={symptom.filePath} />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingId(symptom.id); setShowUpload(false); setExpandedId(null); }}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                            title="Edit symptom"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {deletingId === symptom.id ? (
                            <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleDelete(symptom.id)}
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
                              onClick={(e) => { e.stopPropagation(); setDeletingId(symptom.id); }}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
                              title="Delete symptom"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {expandedId === symptom.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                      {expandedId === symptom.id && (
                        <CardContent className="pt-0 space-y-2 text-sm text-slate-600">
                          {symptom.sourceTitle && <p><span className="text-slate-400">Source:</span> {symptom.sourceTitle}</p>}
                          {symptom.notes && <p>{symptom.notes}</p>}
                          {!symptom.notes && !symptom.sourceTitle && <p className="text-slate-400 italic">No additional notes</p>}
                        </CardContent>
                      )}
                    </>
                  )}
                </Card>
              ))}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
