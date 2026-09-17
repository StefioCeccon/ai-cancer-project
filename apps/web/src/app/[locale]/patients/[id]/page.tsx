import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  User,
  CalendarDays,
  Phone,
  Mail,
  Stethoscope,
  ScanLine,
  FlaskConical,
  FileText,
  BrainCircuit,
  ChevronLeft,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SharePatientPanel } from "@/components/patients/SharePatientPanel";
import { SyncSelectedPatient } from "@/components/patients/SyncSelectedPatient";
import type { Patient } from "@ai-cancer-project/shared";

type PatientWithRole = Patient & { role?: "owner" | "collaborator" | "viewer" };

async function fetchPatient(id: string): Promise<PatientWithRole | null> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const res = await fetch(`${protocol}://${host}/api/patients/${id}`, {
      cache: "no-store",
      // Forward the caller's auth cookie so the protected API authenticates this
      // server-side request (Clerk session lives in the cookie).
      headers: { cookie: headersList.get("cookie") ?? "" },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// Section pages live at top-level routes and use the selected patient from context
// (synced via SyncSelectedPatient on this page) — nested /patients/[id]/… routes do not exist.
const TABS = [
  {
    key: "overview",
    label: "Overview",
    icon: User,
    href: (locale: string, id: string) => `/${locale}/patients/${id}`,
  },
  {
    key: "imaging",
    label: "Imaging",
    icon: ScanLine,
    href: (locale: string, _id: string) => `/${locale}/imaging`,
  },
  {
    key: "blood-tests",
    label: "Blood Tests",
    icon: FlaskConical,
    href: (locale: string, _id: string) => `/${locale}/blood-tests`,
  },
  {
    key: "reports",
    label: "Reports",
    icon: FileText,
    href: (locale: string, _id: string) => `/${locale}/reports`,
  },
  {
    key: "analysis",
    label: "AI Analysis",
    icon: BrainCircuit,
    href: (locale: string, _id: string) => `/${locale}/analysis`,
  },
  {
    key: "mdt",
    label: "MDT Consultation",
    icon: Users,
    href: (locale: string, _id: string) => `/${locale}/mdt`,
  },
];

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, tCommon] = await Promise.all([
    getTranslations("patients"),
    getTranslations("common"),
  ]);

  const patient = await fetchPatient(id);
  if (!patient) notFound();

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const role = patient.role ?? "owner";

  return (
    <AppShell title={t("patientDetails")}>
      <SyncSelectedPatient patientId={id} />
      {/* Back link */}
      <div className="mb-4">
        <Link href={`/${locale}/patients`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4" />
            {tCommon("back")}
          </Button>
        </Link>
      </div>

      {/* Patient info card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-lg sm:text-xl font-bold shrink-0">
                {patient.firstName[0]}
                {patient.lastName[0]}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{fullName}</h1>
                  {role !== "owner" && (
                    <Badge variant={role === "collaborator" ? "success" : "neutral"}>
                      Shared · {role}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {patient.cancerType
                    ? `${patient.cancerType}${patient.cancerStage ? ` · Stage ${patient.cancerStage}` : ""}`
                    : "No diagnosis recorded"}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoRow
              icon={CalendarDays}
              label={t("dateOfBirth")}
              value={
                patient.dateOfBirth
                  ? new Date(patient.dateOfBirth).toLocaleDateString()
                  : undefined
              }
            />
            <InfoRow
              icon={User}
              label={t("gender")}
              value={
                patient.gender
                  ? patient.gender.charAt(0).toUpperCase() +
                    patient.gender.slice(1)
                  : undefined
              }
            />
            <InfoRow
              icon={CalendarDays}
              label={t("diagnosisDate")}
              value={
                patient.diagnosisDate
                  ? new Date(patient.diagnosisDate).toLocaleDateString()
                  : undefined
              }
            />
            <InfoRow
              icon={Mail}
              label={t("email")}
              value={patient.email}
            />
            <InfoRow
              icon={Phone}
              label={t("phone")}
              value={patient.phone}
            />
            <InfoRow
              icon={Stethoscope}
              label={t("primaryPhysician")}
              value={patient.primaryPhysician}
            />
          </div>
          {patient.notes && (
            <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                {t("notes")}
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {patient.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-6">
        <SharePatientPanel patientId={id} myRole={role} />
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href(locale, id)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg border-b-2 border-transparent transition-colors whitespace-nowrap"
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Overview content placeholder */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
          <User className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">Select a tab to view patient data</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
