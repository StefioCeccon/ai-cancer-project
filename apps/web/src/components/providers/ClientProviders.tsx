"use client";

import { PatientProvider } from "@/contexts/PatientContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { MedicalDisclaimerModal } from "@/components/legal/MedicalDisclaimerModal";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <PatientProvider>
      <ChatProvider>
        {children}
        <MedicalDisclaimerModal />
      </ChatProvider>
    </PatientProvider>
  );
}
