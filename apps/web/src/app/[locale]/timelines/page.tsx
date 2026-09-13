"use client";

import { useState, useEffect, useCallback } from "react";
import { GitBranch } from "lucide-react";
import { useLocale } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { PatientTimeline } from "@/components/timeline/PatientTimeline";
import { usePatient } from "@/contexts/PatientContext";
import type { TimelineEvent, TimelineLane } from "@/lib/timeline/types";

export default function TimelinesPage() {
  const locale = useLocale();
  const { selectedPatientId, selectedPatient } = usePatient();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [lanes, setLanes] = useState<TimelineLane[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(
    (patientId: string) => {
      if (!patientId) {
        setEvents([]);
        setLanes([]);
        return;
      }
      setLoading(true);
      setError(null);
      fetch(`/api/timeline?patientId=${patientId}&locale=${locale}`)
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok || !body.success) {
            throw new Error(body.error ?? "Failed to load timeline");
          }
          setEvents(body.data?.events ?? []);
          setLanes(body.data?.lanes ?? []);
        })
        .catch((e: Error) => {
          setError(e.message);
          setEvents([]);
          setLanes([]);
        })
        .finally(() => setLoading(false));
    },
    [locale]
  );

  useEffect(() => {
    loadTimeline(selectedPatientId);
  }, [selectedPatientId, loadTimeline]);

  const patientName = selectedPatient
    ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
    : null;

  const stats = {
    blood: events.filter((e) => e.category === "blood_test").length,
    imaging: events.filter((e) => e.category === "imaging").length,
    reports: events.filter((e) => e.category === "report").length,
  };

  return (
    <AppShell title="Timelines">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-blue-600" />
              Patient Timeline
            </h2>
            {patientName && (
              <p className="text-sm text-slate-500 mt-1">
                {patientName} — blood tests, imaging, and reports over time
              </p>
            )}
          </div>
          {selectedPatientId && events.length > 0 && (
            <div className="flex gap-4 text-xs text-slate-500">
              <span>
                <span className="font-medium text-rose-600">{stats.blood}</span> blood
              </span>
              <span>
                <span className="font-medium text-blue-600">{stats.imaging}</span> imaging
              </span>
              <span>
                <span className="font-medium text-violet-600">{stats.reports}</span> reports
              </span>
            </div>
          )}
        </div>

        {!selectedPatientId && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500 text-sm">
              Select a patient from the header to view their timeline.
            </CardContent>
          </Card>
        )}

        {selectedPatientId && loading && (
          <Card>
            <CardContent className="py-12 text-center text-slate-400 text-sm">
              Loading timeline…
            </CardContent>
          </Card>
        )}

        {selectedPatientId && error && !loading && (
          <Card>
            <CardContent className="py-8 text-center text-red-600 text-sm">{error}</CardContent>
          </Card>
        )}

        {selectedPatientId && !loading && !error && (
          <Card>
            <CardHeader className="py-3 border-b border-slate-100">
              <p className="text-xs text-slate-500">
                Hover a point for a brief summary; click to pin details. Toggle types in the
                legend to focus on specific modalities or report categories.
              </p>
            </CardHeader>
            <CardContent className="pt-5 pb-6">
              <PatientTimeline
                events={events}
                lanes={lanes}
                locale={locale}
                onReportCategoryChange={() => loadTimeline(selectedPatientId)}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
