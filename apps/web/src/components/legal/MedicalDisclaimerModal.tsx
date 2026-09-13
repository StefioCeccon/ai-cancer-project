"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "medical-disclaimer-accepted-v1";

/**
 * One-time medical disclaimer shown on first visit. Acknowledgement is stored in
 * localStorage so it doesn't reappear. Rendered globally (see ClientProviders).
 */
export function MedicalDisclaimerModal() {
  // Start hidden; decide visibility only after mount to avoid SSR hydration
  // mismatch (localStorage is client-only).
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "true") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore — non-persistent acknowledgement is acceptable
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="medical-disclaimer-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-100 p-5">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 id="medical-disclaimer-title" className="text-base font-semibold text-slate-900">
              Medical disclaimer
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Please read before continuing</p>
          </div>
        </div>

        <div className="space-y-3 p-5 text-sm leading-relaxed text-slate-600">
          <p>
            This application is an informational and educational tool. It is{" "}
            <strong className="text-slate-800">not a medical device</strong> and does{" "}
            <strong className="text-slate-800">not provide medical advice, diagnosis, or treatment</strong>.
          </p>
          <p>
            AI-generated insights can be incomplete or wrong and must never replace the judgement of a
            qualified healthcare professional. Always consult your doctor or care team before making any
            decision about your health or treatment.
          </p>
          <p className="text-slate-500">
            In an emergency, contact your local emergency services immediately.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
          <Button onClick={accept}>I understand</Button>
        </div>
      </div>
    </div>
  );
}
