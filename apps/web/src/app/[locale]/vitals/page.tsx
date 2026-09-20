"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Scale, Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MarkerChart } from "@/components/blood-tests/MarkerChart";
import { BloodPressureChart } from "@/components/vitals/BloodPressureChart";
import { formatDate } from "@ai-cancer-project/shared";
import { usePatient } from "@/contexts/PatientContext";

interface VitalRow {
  id: string;
  patientId: string;
  recordedAt: string;
  weightKg: number | null;
  heightCm: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  notes: string | null;
}

function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** Prefer height on the same reading; else most recent prior height. */
function heightForBmi(rowsAsc: VitalRow[], index: number): number | null {
  const own = rowsAsc[index].heightCm;
  if (own != null && own > 0) return own;
  for (let i = index - 1; i >= 0; i--) {
    if (rowsAsc[i].heightCm != null && rowsAsc[i].heightCm! > 0) return rowsAsc[i].heightCm;
  }
  return null;
}

const emptyForm = {
  recordedAt: new Date().toISOString().slice(0, 10),
  weightKg: "",
  heightCm: "",
  bpSystolic: "",
  bpDiastolic: "",
  notes: "",
};

export default function VitalsPage() {
  const { selectedPatientId } = usePatient();
  const [vitals, setVitals] = useState<VitalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((patientId: string) => {
    if (!patientId) {
      setVitals([]);
      return;
    }
    setLoading(true);
    fetch(`/api/vitals?patientId=${patientId}`)
      .then((r) => r.json())
      .then((d) => setVitals(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    load(selectedPatientId);
  }, [selectedPatientId, load]);

  const sortedAsc = useMemo(
    () => [...vitals].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id)),
    [vitals],
  );

  const weightSeries = useMemo(
    () =>
      sortedAsc
        .filter((v) => v.weightKg != null)
        .map((v) => ({ date: v.recordedAt, value: v.weightKg as number })),
    [sortedAsc],
  );

  const bmiSeries = useMemo(() => {
    const points: { date: string; value: number }[] = [];
    sortedAsc.forEach((v, i) => {
      if (v.weightKg == null) return;
      const h = heightForBmi(sortedAsc, i);
      if (h == null) return;
      points.push({ date: v.recordedAt, value: bmi(v.weightKg, h) });
    });
    return points;
  }, [sortedAsc]);

  const bpSeries = useMemo(
    () =>
      sortedAsc
        .filter((v) => v.bpSystolic != null && v.bpDiastolic != null)
        .map((v) => ({
          date: v.recordedAt,
          systolic: v.bpSystolic as number,
          diastolic: v.bpDiastolic as number,
        })),
    [sortedAsc],
  );

  const lastHeight = useMemo(() => {
    for (let i = sortedAsc.length - 1; i >= 0; i--) {
      if (sortedAsc[i].heightCm != null) return String(sortedAsc[i].heightCm);
    }
    return "";
  }, [sortedAsc]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, heightCm: lastHeight });
    setError(null);
    setShowForm(true);
  }

  function openEdit(v: VitalRow) {
    setEditingId(v.id);
    setForm({
      recordedAt: v.recordedAt,
      weightKg: v.weightKg != null ? String(v.weightKg) : "",
      heightCm: v.heightCm != null ? String(v.heightCm) : "",
      bpSystolic: v.bpSystolic != null ? String(v.bpSystolic) : "",
      bpDiastolic: v.bpDiastolic != null ? String(v.bpDiastolic) : "",
      notes: v.notes ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatientId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        patientId: selectedPatientId,
        recordedAt: form.recordedAt,
        weightKg: form.weightKg === "" ? null : Number(form.weightKg),
        heightCm: form.heightCm === "" ? null : Number(form.heightCm),
        bpSystolic: form.bpSystolic === "" ? null : Number(form.bpSystolic),
        bpDiastolic: form.bpDiastolic === "" ? null : Number(form.bpDiastolic),
        notes: form.notes.trim() || null,
      };

      const res = editingId
        ? await fetch(`/api/vitals/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/vitals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok) {
        const msg =
          typeof json.message === "string"
            ? json.message
            : typeof json.error === "string"
              ? json.error
              : "Failed to save";
        throw new Error(msg);
      }
      setShowForm(false);
      setEditingId(null);
      load(selectedPatientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/vitals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeletingId(null);
      load(selectedPatientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const sortedDesc = useMemo(() => [...sortedAsc].reverse(), [sortedAsc]);

  return (
    <AppShell title="Vitals">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Vitals</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Weight, height, and blood pressure over time — used in chat, analysis, and MDT.
            </p>
          </div>
          {selectedPatientId && (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Add reading
            </Button>
          )}
        </div>

        {!selectedPatientId && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-400">
              Select a patient to track vitals.
            </CardContent>
          </Card>
        )}

        {selectedPatientId && showForm && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-800 text-sm">
                {editingId ? "Edit reading" : "New reading"}
              </h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={form.recordedAt}
                      onChange={(e) => setForm((f) => ({ ...f, recordedAt: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={form.weightKg}
                      onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 68.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Height (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={form.heightCm}
                      onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 170"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      BP systolic — high (mmHg)
                    </label>
                    <input
                      type="number"
                      min="40"
                      max="300"
                      value={form.bpSystolic}
                      onChange={(e) => setForm((f) => ({ ...f, bpSystolic: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 120"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      BP diastolic — low (mmHg)
                    </label>
                    <input
                      type="number"
                      min="40"
                      max="300"
                      value={form.bpDiastolic}
                      onChange={(e) => setForm((f) => ({ ...f, bpDiastolic: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 80"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {typeof error === "string" ? error : "Could not save"}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={busy}>
                    {busy ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {selectedPatientId && !loading && (weightSeries.length > 0 || bmiSeries.length > 0 || bpSeries.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {weightSeries.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <MarkerChart markerName="Weight" unit="kg" data={weightSeries} />
                </CardContent>
              </Card>
            )}
            {bmiSeries.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <MarkerChart markerName="BMI" unit="kg/m²" data={bmiSeries} />
                </CardContent>
              </Card>
            )}
            {bpSeries.length > 0 && (
              <Card className="lg:col-span-2">
                <CardContent className="pt-4">
                  <BloodPressureChart data={bpSeries} />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {selectedPatientId && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-800 text-sm">Readings</h2>
            </CardHeader>
            <CardContent>
              {loading && <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>}
              {!loading && sortedDesc.length === 0 && (
                <div className="py-10 text-center text-slate-400">
                  <Scale className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No vitals yet — add weight, height, or blood pressure.</p>
                </div>
              )}
              <ul className="space-y-2">
                {sortedDesc.map((v) => {
                  const h = heightForBmi(
                    sortedAsc,
                    sortedAsc.findIndex((r) => r.id === v.id),
                  );
                  const bmiVal =
                    v.weightKg != null && h != null ? bmi(v.weightKg, h) : null;
                  return (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{formatDate(v.recordedAt)}</p>
                        <p className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {v.weightKg != null && <span>Weight {v.weightKg} kg</span>}
                          {v.heightCm != null && <span>Height {v.heightCm} cm</span>}
                          {bmiVal != null && <span>BMI {bmiVal}</span>}
                          {v.bpSystolic != null && v.bpDiastolic != null && (
                            <span>
                              BP {v.bpSystolic}/{v.bpDiastolic} mmHg
                            </span>
                          )}
                        </p>
                        {v.notes && <p className="text-xs text-slate-400 mt-1">{v.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {deletingId === v.id ? (
                          <>
                            <span className="text-xs text-red-600 font-medium mr-1">Delete?</span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDelete(v.id)}
                              className="px-2 py-0.5 text-xs rounded bg-red-500 text-white"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-0.5 text-xs rounded border border-slate-200"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(v)}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(v.id)}
                              className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
