import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  patients,
  patientMembers,
  patientInvites,
  users,
  type PatientMemberRole,
} from "@/lib/db";

const ROLE_RANK: Record<PatientMemberRole, number> = {
  viewer: 1,
  collaborator: 2,
  owner: 3,
};

export function roleAtLeast(role: PatientMemberRole, min: PatientMemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export type PatientAccess = {
  role: PatientMemberRole;
  patientId: string;
};

/** Membership role for this user on the patient, or null if none. */
export async function getPatientAccess(
  patientId: string,
  userId: string
): Promise<PatientAccess | null> {
  const [member] = await db
    .select({ role: patientMembers.role, patientId: patientMembers.patientId })
    .from(patientMembers)
    .where(and(eq(patientMembers.patientId, patientId), eq(patientMembers.userId, userId)))
    .limit(1);

  if (member) return { role: member.role, patientId: member.patientId };

  // Fallback for rows created before backfill / race: owner via patients.userId
  const [owned] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)))
    .limit(1);

  if (!owned) return null;

  // Heal missing owner membership
  await db
    .insert(patientMembers)
    .values({ patientId, userId, role: "owner" })
    .onConflictDoNothing();

  return { role: "owner", patientId };
}

export async function canAccessPatient(
  patientId: string,
  userId: string,
  minRole: PatientMemberRole = "viewer"
): Promise<boolean> {
  const access = await getPatientAccess(patientId, userId);
  return Boolean(access && roleAtLeast(access.role, minRole));
}

/** Patient ids the user can access (any role). */
export async function getAccessiblePatientIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ patientId: patientMembers.patientId })
    .from(patientMembers)
    .where(eq(patientMembers.userId, userId));

  const ids = new Set<string>(rows.map((r: { patientId: string }) => r.patientId));

  // Include owned patients missing a membership row (pre-migration safety)
  const owned = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.userId, userId));
  for (const p of owned) ids.add(p.id);

  return [...ids];
}

export async function listAccessiblePatients(userId: string) {
  const memberRows = await db
    .select({
      patient: patients,
      role: patientMembers.role,
    })
    .from(patientMembers)
    .innerJoin(patients, eq(patients.id, patientMembers.patientId))
    .where(eq(patientMembers.userId, userId))
    .orderBy(sql`${patients.createdAt} desc`);

  const byId = new Map<string, (typeof memberRows)[number]>();
  for (const row of memberRows) byId.set(row.patient.id, row);

  const owned = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId));

  for (const p of owned) {
    if (!byId.has(p.id)) {
      byId.set(p.id, { patient: p, role: "owner" });
    }
  }

  return [...byId.values()]
    .sort(
      (a, b) =>
        new Date(b.patient.createdAt).getTime() - new Date(a.patient.createdAt).getTime()
    )
    .map(({ patient, role }) => ({ ...patient, role }));
}

/** Ensure owner membership exists when creating a patient. */
export async function ensureOwnerMembership(patientId: string, userId: string) {
  await db
    .insert(patientMembers)
    .values({ patientId, userId, role: "owner" })
    .onConflictDoNothing();
}

/**
 * Accept pending invites for this email (call on sign-in).
 * Creates memberships and marks invites accepted.
 */
export async function acceptPendingInvitesForEmail(userId: string, email: string | null | undefined) {
  if (!email) return;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const pending = await db
    .select()
    .from(patientInvites)
    .where(and(eq(patientInvites.email, normalized), eq(patientInvites.status, "pending")));

  for (const invite of pending) {
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) continue;
    // Never auto-grant owner via invite
    const role: PatientMemberRole =
      invite.role === "owner" ? "collaborator" : invite.role;

    await db
      .insert(patientMembers)
      .values({ patientId: invite.patientId, userId, role })
      .onConflictDoNothing();

    await db
      .update(patientInvites)
      .set({ status: "accepted" })
      .where(eq(patientInvites.id, invite.id));
  }
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);
  return row?.id ?? null;
}

export { inArray };
