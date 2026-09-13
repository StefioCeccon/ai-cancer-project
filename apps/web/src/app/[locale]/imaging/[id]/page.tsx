import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DicomViewerClient } from "@/components/imaging/DicomViewerClient";
import { LinkReportPanel } from "@/components/imaging/LinkReportPanel";
import { MlAnalysisPanel, type SybilResult } from "@/components/imaging/MlAnalysisPanel";
import { AiAnalysisPanel } from "@/components/imaging/AiAnalysisPanel";
import { StudySeriesProvider } from "@/components/imaging/StudySeriesProvider";
import { StudyMlOverlayProvider } from "@/components/imaging/StudyMlOverlayProvider";
import { SegmentAnatomyPanel } from "@/components/imaging/SegmentAnatomyPanel";
import { SegmentOverlayProvider } from "@/components/imaging/SegmentOverlayProvider";
import { imagingStudyHasReportContext } from "@/lib/imaging/linkedReport";
import { sybilResultToViewerOverlay } from "@/lib/imaging/sybil";
import { segmentationToViewerOverlay } from "@/lib/imaging/segmentation";
import { formatDate } from "@cancer-monitor/shared";

async function getStudy(id: string) {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const res = await fetch(`${protocol}://${host}/api/imaging/${id}`, {
    cache: "no-store",
    // Forward the caller's auth cookie so the protected API authenticates this
    // server-side request (Clerk session lives in the cookie).
    headers: { cookie: headersList.get("cookie") ?? "" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data;
}

export default async function ImagingStudyPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const study = await getStudy(id);
  if (!study) notFound();

  const seriesGroups = study.seriesGroups ?? [];
  const filePaths: string[] = study.filePaths ?? [];
  const loadSeriesMetadata = seriesGroups.length > 1 || study.modality === "CT";
  const initialSybilResult = (study.mlModelResults as { sybil?: SybilResult } | null)?.sybil ?? null;
  const initialSybilOverlay = initialSybilResult ? sybilResultToViewerOverlay(initialSybilResult) : null;
  const initialSegmentResult = (study.mlModelResults as { segmentation?: Parameters<typeof segmentationToViewerOverlay>[0] } | null)?.segmentation ?? null;
  const initialSegmentOverlay = initialSegmentResult ? segmentationToViewerOverlay(initialSegmentResult) : null;
  const hasLinkedReport = imagingStudyHasReportContext(study.radiologistReport, study.linkedReports ?? []);

  return (
    <AppShell title="Imaging Study">
      <StudySeriesProvider studyId={study.id} enabled={loadSeriesMetadata}>
      <StudyMlOverlayProvider
        initialOverlay={initialSybilOverlay}
        initialSeriesNumber={initialSybilOverlay?.seriesNumber ?? seriesGroups[0]?.seriesNumber}
      >
      <SegmentOverlayProvider initialOverlay={initialSegmentOverlay}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DICOM Viewer */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {study.modality} — {study.bodyPart}
              </h3>
              <Badge variant="info">{study.modality}</Badge>
            </CardHeader>
            <CardContent>
              <DicomViewerClient
                studyId={study.id}
                seriesGroups={seriesGroups.length > 0 ? seriesGroups : [{ seriesNumber: 0, label: "All slices", instanceCount: filePaths.length, filePaths, instances: [] }]}
                className="w-full"
              />
            </CardContent>
          </Card>
        </div>

        {/* Study info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h4 className="font-semibold text-slate-800 text-sm">Study Details</h4>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "Modality", value: study.modality },
                { label: "Body Part", value: study.bodyPart },
                { label: "Date", value: formatDate(study.studyDate) },
                { label: "Series", value: study.seriesCount },
                { label: "Instances", value: study.instanceCount },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-800 font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {study.radiologistReport && (
            <Card>
              <CardHeader><h4 className="font-semibold text-sm text-slate-800">Radiologist Report</h4></CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{study.radiologistReport}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              <MlAnalysisPanel
                studyId={study.id}
                modality={study.modality}
                initialResults={initialSybilResult}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <AiAnalysisPanel
                studyId={study.id}
                modality={study.modality}
                initialFindings={study.aiFindings ?? null}
                hasSybilResults={!!initialSybilResult}
                instanceCount={study.instanceCount}
                hasLinkedReport={hasLinkedReport}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <SegmentAnatomyPanel
                studyId={study.id}
                modality={study.modality}
                initialResult={initialSegmentResult}
                sybilSeriesNumber={initialSybilResult?.series_number}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <LinkReportPanel
                studyId={study.id}
                patientId={study.patientId}
                initialLinkedReports={study.linkedReports ?? []}
              />
            </CardContent>
          </Card>

          <a href={`/${locale}/imaging`} className="block">
            <button className="w-full text-sm text-slate-500 hover:text-slate-700 text-center py-2">
              ← Back to Imaging
            </button>
          </a>
        </div>
      </div>
      </SegmentOverlayProvider>
      </StudyMlOverlayProvider>
      </StudySeriesProvider>
    </AppShell>
  );
}
