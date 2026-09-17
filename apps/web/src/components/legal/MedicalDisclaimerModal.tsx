"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Bump when disclaimer text changes so users re-acknowledge. */
const STORAGE_KEY = "medical-disclaimer-accepted-v2";

/**
 * One-time medical + AI-data disclaimer shown on first visit (or after key bump).
 */
export function MedicalDisclaimerModal() {
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
      // ignore
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
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3 border-b border-slate-100 p-5">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 id="medical-disclaimer-title" className="text-base font-semibold text-slate-900">
              Before you continue
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Medical and data notice</p>
          </div>
        </div>

        <div className="space-y-3 p-5 text-sm leading-relaxed text-slate-600">
          <p>
            This application is an informational tool. It is{" "}
            <strong className="text-slate-800">not a medical device</strong> and does{" "}
            <strong className="text-slate-800">not provide medical advice, diagnosis, or treatment</strong>.
            AI output can be wrong — always involve a qualified clinician.
          </p>
          <p>
            <strong className="text-slate-800">AI providers.</strong> When you run chat, analysis, MDT, or
            imaging AI, selected patient data (labs, reports, notes, and sometimes scan images) is sent to
            the AI provider you choose (for example Google Gemini, OpenAI, Anthropic, or Mistral) so the
            model can respond. Do not use those features with data you are not comfortable sharing with that
            provider.
          </p>
          <p>
            <strong className="text-slate-800">Sharing.</strong> If you invite someone to a patient record,
            they can see that patient’s data (and files) according to the role you give them.
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
