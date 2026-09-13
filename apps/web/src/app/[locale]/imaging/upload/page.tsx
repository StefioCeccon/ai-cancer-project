"use client";

import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { UploadDicom } from "@/components/imaging/UploadDicom";
import { usePatient } from "@/contexts/PatientContext";

export default function ImagingUploadPage() {
  const params = useParams<{ locale: string }>();
  const router = useRouter();
  const { selectedPatientId, selectedPatient } = usePatient();

  return (
    <AppShell title="Upload Imaging Study">
      <div className="max-w-2xl mx-auto space-y-4">
        {!selectedPatientId && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500 text-sm">
              Select a patient from the header before uploading an imaging study.
            </CardContent>
          </Card>
        )}

        {selectedPatientId && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-800">
                Upload DICOM Files
                {selectedPatient && (
                  <span className="font-normal text-slate-500">
                    {" "}for {selectedPatient.firstName} {selectedPatient.lastName}
                  </span>
                )}
              </h3>
            </CardHeader>
            <CardContent>
              <UploadDicom
                patientId={selectedPatientId}
                onSuccess={(studyId) => router.push(`/${params.locale}/imaging/${studyId}`)}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
