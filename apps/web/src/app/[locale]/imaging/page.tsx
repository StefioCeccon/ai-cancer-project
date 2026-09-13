"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Scan, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDateShort } from "@cancer-monitor/shared";
import { usePatient } from "@/contexts/PatientContext";

interface Study {
  id: string;
  patientId: string;
  modality: string;
  studyDate: string;
  bodyPart: string;
  description?: string;
  seriesCount: number;
  instanceCount: number;
}

export default function ImagingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const { selectedPatientId } = usePatient();
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadStudies = useCallback((patientId: string) => {
    if (!patientId) {
      setStudies([]);
      return;
    }
    setLoading(true);
    fetch(`/api/imaging?patientId=${patientId}`)
      .then((r) => r.json())
      .then((d) => setStudies(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStudies(selectedPatientId);
  }, [selectedPatientId, loadStudies]);

  async function deleteStudy(id: string) {
    if (!confirm("Delete this imaging study? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/imaging/${id}`, { method: "DELETE" });
      setStudies((s) => s.filter((x) => x.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AppShell title="Imaging">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-800">Imaging Studies</h2>
          <Link href={`/${locale}/imaging/upload`}>
            <Button size="sm"><Plus className="w-4 h-4" /> Upload Study</Button>
          </Link>
        </div>

        {!selectedPatientId && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500 text-sm">
              Select a patient from the header to view their imaging studies.
            </CardContent>
          </Card>
        )}

        {selectedPatientId && loading && (
          <div className="text-center py-12 text-slate-400">Loading…</div>
        )}

        {selectedPatientId && !loading && studies.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Scan className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">No imaging studies for this patient yet</p>
              <Link href={`/${locale}/imaging/upload`}>
                <Button variant="secondary">Upload Study</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {selectedPatientId && !loading && studies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studies.map((study) => (
              <Card key={study.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex items-center justify-between py-3">
                  <Badge variant="info">{study.modality}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{formatDateShort(study.studyDate)}</span>
                    <button
                      onClick={() => deleteStudy(study.id)}
                      disabled={deleting === study.id}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                      title="Delete study"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <p className="font-medium text-slate-800">{study.bodyPart}</p>
                  {study.description && (
                    <p className="text-sm text-slate-500 mt-1">{study.description}</p>
                  )}
                  <div className="flex gap-3 mt-3 text-xs text-slate-400">
                    <span>{study.seriesCount} series</span>
                    <span>{study.instanceCount} {study.modality === "XRAY" ? "images" : "instances"}</span>
                  </div>
                  <div className="mt-4">
                    <Link href={`/${locale}/imaging/${study.id}`}>
                      <Button variant="secondary" size="sm" className="w-full">
                        <Scan className="w-3.5 h-3.5" /> View Study
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
