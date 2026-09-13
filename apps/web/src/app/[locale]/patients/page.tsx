import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { headers } from "next/headers";
import { UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Patient } from "@cancer-monitor/shared";

async function fetchPatients(): Promise<Patient[]> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const res = await fetch(`${protocol}://${host}/api/patients`, {
      cache: "no-store",
      // Forward the caller's auth cookie so the protected API authenticates this
      // server-side request (Clerk session lives in the cookie).
      headers: { cookie: headersList.get("cookie") ?? "" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export default async function PatientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, tCommon] = await Promise.all([
    getTranslations("patients"),
    getTranslations("common"),
  ]);

  const patients = await fetchPatients();

  return (
    <AppShell title={t("title")}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <Link href={`/${locale}/patients/new`}>
          <Button variant="primary">
            <UserPlus className="w-4 h-4" />
            {t("addPatient")}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-500">
            {patients.length} patient{patients.length !== 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <UserPlus className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">{tCommon("noData")}</p>
              <Link href={`/${locale}/patients/new`} className="mt-4">
                <Button variant="secondary" size="sm">
                  {t("addPatient")}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-6 py-3 font-medium text-slate-600">Name</th>
                    <th className="px-6 py-3 font-medium text-slate-600">
                      {t("dateOfBirth")}
                    </th>
                    <th className="px-6 py-3 font-medium text-slate-600">
                      {t("cancerType")}
                    </th>
                    <th className="px-6 py-3 font-medium text-slate-600">
                      {t("cancerStage")}
                    </th>
                    <th className="px-6 py-3 font-medium text-slate-600">
                      {t("diagnosisDate")}
                    </th>
                    <th className="px-6 py-3 font-medium text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patients.map((patient) => (
                    <tr
                      key={patient.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {patient.firstName} {patient.lastName}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {patient.dateOfBirth
                          ? new Date(patient.dateOfBirth).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {patient.cancerType ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {patient.cancerStage
                          ? `Stage ${patient.cancerStage}`
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {patient.diagnosisDate
                          ? new Date(patient.diagnosisDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/${locale}/patients/${patient.id}`}>
                          <Button variant="ghost" size="sm">
                            {tCommon("view")}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
