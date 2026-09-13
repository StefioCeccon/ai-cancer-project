import { NextRequest, NextResponse } from "next/server";
import { db, bloodTests, bloodMarkers, imagingStudies, medicalReports, symptoms, therapies, therapyMedications } from "@/lib/db";
import { and, eq, asc } from "drizzle-orm";
import { buildTimelineResponse } from "@/lib/timeline/buildEvents";
import { ensureReportTimelineCategories } from "@/lib/timeline/ensureReportTimelineCategories";
import { getCurrentUserId, isPatientOwnedBy } from "@/lib/auth/user";
import { runWithUserKeys } from "@/lib/ai/keyContext";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const locale = searchParams.get("locale") ?? "en";

    if (!patientId) {
      return NextResponse.json(
        { error: "patientId is required", success: false },
        { status: 400 }
      );
    }

    if (!(await isPatientOwnedBy(patientId, userId))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const [tests, studies, reports, symptomRows, therapyRows] = await Promise.all([
      db
        .select()
        .from(bloodTests)
        .where(and(eq(bloodTests.userId, userId), eq(bloodTests.patientId, patientId)))
        .orderBy(asc(bloodTests.testDate)),
      db
        .select()
        .from(imagingStudies)
        .where(and(eq(imagingStudies.userId, userId), eq(imagingStudies.patientId, patientId)))
        .orderBy(asc(imagingStudies.studyDate)),
      db
        .select()
        .from(medicalReports)
        .where(and(eq(medicalReports.userId, userId), eq(medicalReports.patientId, patientId)))
        .orderBy(asc(medicalReports.reportDate)),
      db
        .select()
        .from(symptoms)
        .where(and(eq(symptoms.userId, userId), eq(symptoms.patientId, patientId)))
        .orderBy(asc(symptoms.startDate)),
      db
        .select()
        .from(therapies)
        .where(and(eq(therapies.userId, userId), eq(therapies.patientId, patientId)))
        .orderBy(asc(therapies.startDate)),
    ]);

    type TestRow = (typeof tests)[number];
    type MarkerRow = typeof bloodMarkers.$inferSelect;
    type TherapyRow = (typeof therapyRows)[number];

    const testIds = tests.map((t: TestRow) => t.id);
    const allMarkers: MarkerRow[][] =
      testIds.length > 0
        ? await Promise.all(
            testIds.map((id: string) =>
              db.select().from(bloodMarkers).where(eq(bloodMarkers.bloodTestId, id))
            )
          )
        : [];

    const markersByTestId = new Map<string, MarkerRow[]>();
    testIds.forEach((id: string, i: number) => {
      markersByTestId.set(id, allMarkers[i] ?? []);
    });

    const therapyIds = therapyRows.map((t: TherapyRow) => t.id);
    const allTherapyMeds =
      therapyIds.length > 0
        ? await Promise.all(
            therapyIds.map((id: string) =>
              db.select().from(therapyMedications).where(eq(therapyMedications.therapyId, id))
            )
          )
        : [];

    const therapiesWithMedCount = therapyRows.map((t: TherapyRow, i: number) => ({
      ...t,
      medicationCount: allTherapyMeds[i]?.length ?? 0,
      medicationNames: allTherapyMeds[i]?.map((m: { name: string }) => m.name) ?? [],
    }));

    const data = buildTimelineResponse(
      tests,
      markersByTestId,
      studies,
      await runWithUserKeys(userId, () => ensureReportTimelineCategories(reports)),
      symptomRows,
      therapiesWithMedCount,
      locale
    );

    return NextResponse.json({ data, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
