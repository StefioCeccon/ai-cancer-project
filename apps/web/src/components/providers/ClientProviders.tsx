"use client";

import { PatientProvider } from "@/contexts/PatientContext";
import { MedicalDisclaimerModal } from "@/components/legal/MedicalDisclaimerModal";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <PatientProvider>
      {children}
      <MedicalDisclaimerModal />
    </PatientProvider>
  );
}
