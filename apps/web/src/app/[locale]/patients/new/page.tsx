"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { usePatient } from "@/contexts/PatientContext";
import { CANCER_TYPES, CANCER_STAGES } from "@ai-cancer-project/shared";
import type { PatientCreate } from "@ai-cancer-project/shared";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50";

const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export default function NewPatientPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const t = useTranslations("patients");
  const tCommon = useTranslations("common");
  const { refreshPatients, setSelectedPatientId } = usePatient();

  const [form, setForm] = useState<PatientCreate>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "other",
    email: "",
    phone: "",
    diagnosisDate: "",
    cancerType: "",
    cancerStage: "",
    primaryPhysician: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: PatientCreate = {
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
        diagnosisDate: form.diagnosisDate || undefined,
        cancerType: form.cancerType || undefined,
        cancerStage: form.cancerStage || undefined,
        primaryPhysician: form.primaryPhysician || undefined,
        notes: form.notes || undefined,
      };

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create patient");
      }

      // Refresh the shared patient list (powers the header dropdown) and select the
      // newly created patient so it's available immediately without a manual refresh.
      const created = (await res.json().catch(() => ({}))).data;
      await refreshPatients();
      if (created?.id) setSelectedPatientId(created.id);

      router.refresh();
      router.push(`/${locale}/patients`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title={t("addPatient")}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{t("addPatient")}</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${locale}/patients`)}
          >
            {tCommon("back")}
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-4">
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-800">
                Personal Information
              </h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label htmlFor="firstName" className={labelClass}>
                    {t("firstName")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={form.firstName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="John"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label htmlFor="lastName" className={labelClass}>
                    {t("lastName")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={form.lastName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Doe"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label htmlFor="dateOfBirth" className={labelClass}>
                    {t("dateOfBirth")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    required
                    value={form.dateOfBirth}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                {/* Gender */}
                <div>
                  <label htmlFor="gender" className={labelClass}>
                    {t("gender")} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    required
                    value={form.gender}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="male">{t("male")}</option>
                    <option value="female">{t("female")}</option>
                    <option value="other">{t("other")}</option>
                  </select>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className={labelClass}>
                    {t("email")}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="patient@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className={labelClass}>
                    {t("phone")}
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="+1 555 000 0000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-800">
                Clinical Information
              </h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Diagnosis Date */}
                <div>
                  <label htmlFor="diagnosisDate" className={labelClass}>
                    {t("diagnosisDate")}
                  </label>
                  <input
                    id="diagnosisDate"
                    name="diagnosisDate"
                    type="date"
                    value={form.diagnosisDate}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                {/* Primary Physician */}
                <div>
                  <label htmlFor="primaryPhysician" className={labelClass}>
                    {t("primaryPhysician")}
                  </label>
                  <input
                    id="primaryPhysician"
                    name="primaryPhysician"
                    type="text"
                    value={form.primaryPhysician}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Dr. Smith"
                  />
                </div>

                {/* Cancer Type */}
                <div>
                  <label htmlFor="cancerType" className={labelClass}>
                    {t("cancerType")}
                  </label>
                  <select
                    id="cancerType"
                    name="cancerType"
                    value={form.cancerType}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">— Select type —</option>
                    {CANCER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cancer Stage */}
                <div>
                  <label htmlFor="cancerStage" className={labelClass}>
                    {t("cancerStage")}
                  </label>
                  <select
                    id="cancerStage"
                    name="cancerStage"
                    value={form.cancerStage}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">— Select stage —</option>
                    {CANCER_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        Stage {stage}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label htmlFor="notes" className={labelClass}>
                    {t("notes")}
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    value={form.notes}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Additional clinical notes..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/${locale}/patients`)}
              disabled={loading}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              {tCommon("save")}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
