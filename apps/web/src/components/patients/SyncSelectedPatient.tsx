"use client";

import { useEffect } from "react";
import { usePatient } from "@/contexts/PatientContext";

/** Keep the header patient picker in sync when viewing a patient detail URL. */
export function SyncSelectedPatient({ patientId }: { patientId: string }) {
  const { selectedPatientId, setSelectedPatientId } = usePatient();

  useEffect(() => {
    if (patientId && patientId !== selectedPatientId) {
      setSelectedPatientId(patientId);
    }
  }, [patientId, selectedPatientId, setSelectedPatientId]);

  return null;
}
