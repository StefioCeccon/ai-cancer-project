"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FlaskConical, Plus, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MarkerTable } from "@/components/blood-tests/MarkerTable";
import { MarkerChart } from "@/components/blood-tests/MarkerChart";
import { UploadBloodTest } from "@/components/blood-tests/UploadBloodTest";
import { BulkUploadBloodTests } from "@/components/blood-tests/BulkUploadBloodTests";
import { BloodTestSourceFiles } from "@/components/blood-tests/BloodTestSourceFiles";
import { formatDate } from "@ai-cancer-project/shared";
import type { BloodMarker } from "@ai-cancer-project/shared";
import { usePatient } from "@/contexts/PatientContext";
import {
  getMarkerHistoryByAliases,
  markerMatchesAliases,
  CALCIUM_ALIASES,
  MAGNESIUM_ALIASES,
  POTASSIUM_ALIASES,
  SODIUM_ALIASES,
  VITAMIN_D_ALIASES,
  VITAMIN_B12_ALIASES,
} from "@/lib/blood-tests/markerMatching";

interface BloodTestRecord {
  id: string;
  patientId: string;
  testDate: string;
  labName?: string | null;
  requestingPhysician?: string | null;
  rawText?: string | null;
  filePath?: string | null;
  markers: (BloodMarker & { id: string; bloodTestId: string })[];
}

export default function BloodTestsPage() {
  const { selectedPatientId } = usePatient();
  const [tests, setTests] = useState<BloodTestRecord[]>([]);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<"single" | "bulk">("single");
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTests = useCallback((patientId: string) => {
    if (!patientId) { setTests([]); return; }
    setLoading(true);
    fetch(`/api/blood-tests?patientId=${patientId}`)
      .then((r) => r.json())
      .then((d) => setTests(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setShowUpload(false);
    setUploadMode("single");
    setEditingTestId(null);
    setDeletingTestId(null);
    loadTests(selectedPatientId);
  }, [selectedPatientId, loadTests]);

  const sortedTests = useMemo(
    () => [...tests].sort((a, b) => b.testDate.localeCompare(a.testDate) || b.id.localeCompare(a.id)),
    [tests]
  );

  const sodiumHistory = useMemo(
    () => getMarkerHistoryByAliases(sortedTests, SODIUM_ALIASES),
    [sortedTests]
  );

  const potassiumHistory = useMemo(
    () => getMarkerHistoryByAliases(sortedTests, POTASSIUM_ALIASES),
    [sortedTests]
  );

  const calciumHistory = useMemo(
    () => getMarkerHistoryByAliases(sortedTests, CALCIUM_ALIASES),
    [sortedTests]
  );

  const magnesiumHistory = useMemo(
    () => getMarkerHistoryByAliases(sortedTests, MAGNESIUM_ALIASES),
    [sortedTests]
  );

  const vitaminDHistory = useMemo(
    () => getMarkerHistoryByAliases(sortedTests, VITAMIN_D_ALIASES),
    [sortedTests]
  );

  const vitaminB12History = useMemo(
    () => getMarkerHistoryByAliases(sortedTests, VITAMIN_B12_ALIASES),
    [sortedTests]
  );

  function getMarkerHistory(name: string) {
    return sortedTests
      .filter((t) => t.markers.some((m) => m.name === name))
      .map((t) => {
        const marker = t.markers.find((m) => m.name === name)!;
        return {
          date: t.testDate,
          value: marker.value,
          referenceMin: marker.referenceMin,
          referenceMax: marker.referenceMax,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const allMarkerNames = [...new Set(sortedTests.flatMap((t) => t.markers.map((m) => m.name)))];
  const latestSodium = sodiumHistory[sodiumHistory.length - 1];
  const latestPotassium = potassiumHistory[potassiumHistory.length - 1];
  const latestCalcium = calciumHistory[calciumHistory.length - 1];
  const latestMagnesium = magnesiumHistory[magnesiumHistory.length - 1];
  const latestVitaminD = vitaminDHistory[vitaminDHistory.length - 1];
  const latestVitaminB12 = vitaminB12History[vitaminB12History.length - 1];

  function handleSuccess() {
    setShowUpload(false);
    setEditingTestId(null);
    loadTests(selectedPatientId);
  }

  async function handleDelete(testId: string) {
    await fetch(`/api/blood-tests/${testId}`, { method: "DELETE" });
    setDeletingTestId(null);
    loadTests(selectedPatientId);
  }

  return (
    <AppShell title="Blood Tests">
      <div className="space-y-5">
        {selectedPatientId && !editingTestId && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowUpload((v) => !v)}>
              <Plus className="w-4 h-4" /> Add Test
            </Button>
          </div>
        )}

        {!selectedPatientId && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500 text-sm">
              Select a patient from the header to view blood tests.
            </CardContent>
          </Card>
        )}

        {/* Add test form */}
        {showUpload && selectedPatientId && !editingTestId && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-800">
                  {uploadMode === "bulk" ? "Bulk Upload Blood Tests" : "Add Blood Test"}
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
                <BulkUploadBloodTests
                  patientId={selectedPatientId}
                  onSuccess={handleSuccess}
                  onCancel={() => setShowUpload(false)}
                />
              ) : (
                <UploadBloodTest
                  patientId={selectedPatientId}
                  onSuccess={handleSuccess}
                  onCancel={() => setShowUpload(false)}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Electrolyte trends */}
        {selectedPatientId && !editingTestId && (
          sodiumHistory.length > 0 ||
          potassiumHistory.length > 0 ||
          calciumHistory.length > 0 ||
          magnesiumHistory.length > 0
        ) && (
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-800">Electrolytes</h3></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sodiumHistory.length > 0 && (
                  <MarkerChart
                    markerName="Sodium"
                    unit={latestSodium?.unit ?? "mmol/L"}
                    data={sodiumHistory}
                    referenceMin={latestSodium?.referenceMin}
                    referenceMax={latestSodium?.referenceMax}
                  />
                )}
                {potassiumHistory.length > 0 && (
                  <MarkerChart
                    markerName="Potassium"
                    unit={latestPotassium?.unit ?? "mmol/L"}
                    data={potassiumHistory}
                    referenceMin={latestPotassium?.referenceMin}
                    referenceMax={latestPotassium?.referenceMax}
                  />
                )}
                {calciumHistory.length > 0 && (
                  <MarkerChart
                    markerName="Calcium"
                    unit={latestCalcium?.unit ?? "mg/dL"}
                    data={calciumHistory}
                    referenceMin={latestCalcium?.referenceMin}
                    referenceMax={latestCalcium?.referenceMax}
                  />
                )}
                {magnesiumHistory.length > 0 && (
                  <MarkerChart
                    markerName="Magnesium"
                    unit={latestMagnesium?.unit ?? "mg/dL"}
                    data={magnesiumHistory}
                    referenceMin={latestMagnesium?.referenceMin}
                    referenceMax={latestMagnesium?.referenceMax}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vitamins & Nutrients */}
        {selectedPatientId && !editingTestId && (vitaminDHistory.length > 0 || vitaminB12History.length > 0) && (
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-800">Vitamins &amp; Nutrients</h3></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {vitaminDHistory.length > 0 && (
                  <MarkerChart
                    markerName="Vitamin D"
                    unit={latestVitaminD?.unit ?? "ng/mL"}
                    data={vitaminDHistory}
                    referenceMin={latestVitaminD?.referenceMin}
                    referenceMax={latestVitaminD?.referenceMax}
                  />
                )}
                {vitaminB12History.length > 0 && (
                  <MarkerChart
                    markerName="Vitamin B12"
                    unit={latestVitaminB12?.unit ?? "pg/mL"}
                    data={vitaminB12History}
                    referenceMin={latestVitaminB12?.referenceMin}
                    referenceMax={latestVitaminB12?.referenceMax}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other marker trends */}
        {selectedPatientId && sortedTests.length > 1 && allMarkerNames.length > 0 && !editingTestId && (
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-800">Marker Trends</h3></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {allMarkerNames
                  .filter(
                    (name) =>
                      !markerMatchesAliases(name, SODIUM_ALIASES) &&
                      !markerMatchesAliases(name, POTASSIUM_ALIASES) &&
                      !markerMatchesAliases(name, CALCIUM_ALIASES) &&
                      !markerMatchesAliases(name, MAGNESIUM_ALIASES) &&
                      !markerMatchesAliases(name, VITAMIN_D_ALIASES) &&
                      !markerMatchesAliases(name, VITAMIN_B12_ALIASES)
                  )
                  .slice(0, 6)
                  .map((name) => {
                  const history = getMarkerHistory(name);
                  const lastMarker = sortedTests[0]?.markers.find((m) => m.name === name);
                  return (
                    <MarkerChart
                      key={name}
                      markerName={name}
                      unit={lastMarker?.unit ?? ""}
                      data={history}
                      referenceMin={lastMarker?.referenceMin ?? undefined}
                      referenceMax={lastMarker?.referenceMax ?? undefined}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedPatientId && loading && <div className="text-center py-8 text-slate-400">Loading...</div>}

        {selectedPatientId && !loading && sortedTests.length === 0 && !showUpload && (
          <Card>
            <CardContent className="py-12 text-center">
              <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No blood tests recorded yet</p>
            </CardContent>
          </Card>
        )}

        {selectedPatientId && sortedTests.map((test) => (
          <Card key={test.id}>
            {/* Edit form inline */}
            {editingTestId === test.id ? (
              <>
                <CardHeader>
                  <h3 className="font-semibold text-slate-800">Edit Blood Test</h3>
                </CardHeader>
                <CardContent>
                  <UploadBloodTest
                    patientId={selectedPatientId}
                    initialData={{
                      testId: test.id,
                      testDate: test.testDate,
                      labName: test.labName,
                      requestingPhysician: test.requestingPhysician,
                      rawText: test.rawText,
                      markers: test.markers.map((m) => ({
                        name: m.name,
                        value: String(m.value),
                        unit: m.unit,
                        referenceMin: m.referenceMin != null ? String(m.referenceMin) : "",
                        referenceMax: m.referenceMax != null ? String(m.referenceMax) : "",
                      })),
                    }}
                    onSuccess={handleSuccess}
                    onCancel={() => setEditingTestId(null)}
                  />
                </CardContent>
              </>
            ) : (
              /* Normal collapsed/expanded view */
              <>
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full px-4 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 transition-colors rounded-xl cursor-pointer"
                  onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedTest(expandedTest === test.id ? null : test.id); }}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <FlaskConical className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-left">
                          <p className="font-medium text-slate-800">{formatDate(test.testDate)}</p>
                          {test.labName && <p className="text-sm text-slate-500 truncate">{test.labName}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 sm:hidden">
                          <span className="text-xs text-slate-400 whitespace-nowrap">{test.markers.length} markers</span>
                          {expandedTest === test.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {test.markers
                          .filter((m) => m.status !== "normal")
                          .slice(0, 3)
                          .map((m) => (
                            <Badge
                              key={m.name}
                              variant={m.status.includes("critical") ? "danger" : m.status === "high" ? "warning" : "neutral"}
                            >
                              {m.name}: {m.value}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 pl-8 sm:pl-0 shrink-0">
                    <span className="hidden sm:inline text-xs text-slate-400 whitespace-nowrap">{test.markers.length} markers</span>
                    <BloodTestSourceFiles filePath={test.filePath} />
                    {deletingTestId === test.id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-red-600 font-medium">Delete?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(test.id)}
                          className="px-2 py-0.5 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTestId(null)}
                          className="px-2 py-0.5 text-xs rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeletingTestId(test.id); }}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete test"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingTestId(test.id); setShowUpload(false); setExpandedTest(null); }}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      title="Edit test"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <span className="hidden sm:inline">
                      {expandedTest === test.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </span>
                  </div>
                </div>
                {expandedTest === test.id && (
                  <CardContent className="pt-0">
                    <MarkerTable markers={test.markers} />
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
