import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { Users, Scan, FlaskConical, BrainCircuit } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { db, patients, imagingStudies, bloodTests, analysisRuns } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/user";

async function fetchCounts(userId: string) {
  const [
    [{ value: totalPatients }],
    [{ value: totalScans }],
    [{ value: totalTests }],
    [{ value: totalAnalyses }],
  ] = await Promise.all([
    db.select({ value: count() }).from(patients).where(eq(patients.userId, userId)),
    db.select({ value: count() }).from(imagingStudies).where(eq(imagingStudies.userId, userId)),
    db.select({ value: count() }).from(bloodTests).where(eq(bloodTests.userId, userId)),
    db.select({ value: count() }).from(analysisRuns).where(eq(analysisRuns.userId, userId)),
  ]);
  return { totalPatients, totalScans, totalTests, totalAnalyses };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const userId = await getCurrentUserId();
  const counts = userId
    ? await fetchCounts(userId)
    : { totalPatients: 0, totalScans: 0, totalTests: 0, totalAnalyses: 0 };

  return (
    <AppShell title="Dashboard">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Patients"
          value={counts.totalPatients}
          icon={Users}
          iconColor="text-blue-600"
        />
        <StatCard
          label="Imaging Studies"
          value={counts.totalScans}
          icon={Scan}
          iconColor="text-violet-600"
        />
        <StatCard
          label="Blood Tests"
          value={counts.totalTests}
          icon={FlaskConical}
          iconColor="text-emerald-600"
        />
        <StatCard
          label="AI Analyses"
          value={counts.totalAnalyses}
          icon={BrainCircuit}
          iconColor="text-rose-600"
        />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-800">Quick Actions</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/patients/new`}>
              <Button variant="primary">
                <Users className="w-4 h-4" />
                Add Patient
              </Button>
            </Link>
            <Link href={`/${locale}/imaging`}>
              <Button variant="secondary">
                <Scan className="w-4 h-4" />
                Upload Scan
              </Button>
            </Link>
            <Link href={`/${locale}/blood-tests`}>
              <Button variant="secondary">
                <FlaskConical className="w-4 h-4" />
                Upload Test
              </Button>
            </Link>
            <Link href={`/${locale}/analysis`}>
              <Button variant="secondary">
                <BrainCircuit className="w-4 h-4" />
                Run Analysis
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
