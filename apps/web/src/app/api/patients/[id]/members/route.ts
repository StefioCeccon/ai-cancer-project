import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  patientMembers,
  patientInvites,
  users,
  type PatientMemberRole,
} from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/user";
import {
  canAccessPatient,
  findUserIdByEmail,
  getPatientAccess,
} from "@/lib/auth/access";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["collaborator", "viewer"]),
});

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["collaborator", "viewer"]),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id: patientId } = await params;
    if (!(await canAccessPatient(patientId, userId, "viewer"))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const members = await db
      .select({
        id: patientMembers.id,
        userId: patientMembers.userId,
        role: patientMembers.role,
        createdAt: patientMembers.createdAt,
        email: users.email,
      })
      .from(patientMembers)
      .leftJoin(users, eq(users.id, patientMembers.userId))
      .where(eq(patientMembers.patientId, patientId));

    const invites = await db
      .select({
        id: patientInvites.id,
        email: patientInvites.email,
        role: patientInvites.role,
        status: patientInvites.status,
        createdAt: patientInvites.createdAt,
        expiresAt: patientInvites.expiresAt,
      })
      .from(patientInvites)
      .where(
        and(eq(patientInvites.patientId, patientId), eq(patientInvites.status, "pending"))
      );

    const access = await getPatientAccess(patientId, userId);

    return NextResponse.json({
      data: {
        members,
        invites,
        myRole: access?.role ?? "viewer",
        myUserId: userId,
      },
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

/** Invite by email — adds immediately if user exists, else pending invite. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id: patientId } = await params;
    if (!(await canAccessPatient(patientId, userId, "owner"))) {
      return NextResponse.json(
        { error: "Only the owner can invite people", success: false },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const role = parsed.data.role as PatientMemberRole;

    const existingUserId = await findUserIdByEmail(email);
    if (existingUserId === userId) {
      return NextResponse.json(
        { error: "You already own this patient", success: false },
        { status: 400 }
      );
    }

    if (existingUserId) {
      const [existing] = await db
        .select()
        .from(patientMembers)
        .where(
          and(
            eq(patientMembers.patientId, patientId),
            eq(patientMembers.userId, existingUserId)
          )
        )
        .limit(1);

      if (existing) {
        return NextResponse.json(
          { error: "This person already has access", success: false },
          { status: 409 }
        );
      }

      const [member] = await db
        .insert(patientMembers)
        .values({ patientId, userId: existingUserId, role })
        .returning();

      return NextResponse.json(
        { data: { type: "member", member }, success: true },
        { status: 201 }
      );
    }

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days
    const [invite] = await db
      .insert(patientInvites)
      .values({
        patientId,
        email,
        role,
        invitedByUserId: userId,
        status: "pending",
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [patientInvites.patientId, patientInvites.email],
        set: {
          role,
          status: "pending",
          invitedByUserId: userId,
          expiresAt,
        },
      })
      .returning();

    return NextResponse.json(
      {
        data: { type: "invite", invite },
        success: true,
        message:
          "Invite saved. They will get access automatically when they sign up with this email.",
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

/** Update a non-owner member's role. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id: patientId } = await params;
    if (!(await canAccessPatient(patientId, userId, "owner"))) {
      return NextResponse.json({ error: "Forbidden", success: false }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const [member] = await db
      .select()
      .from(patientMembers)
      .where(
        and(
          eq(patientMembers.patientId, patientId),
          eq(patientMembers.userId, parsed.data.userId)
        )
      )
      .limit(1);

    if (!member) {
      return NextResponse.json({ error: "Member not found", success: false }, { status: 404 });
    }
    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Cannot change the owner role", success: false },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(patientMembers)
      .set({ role: parsed.data.role })
      .where(eq(patientMembers.id, member.id))
      .returning();

    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

/** Remove a member or revoke a pending invite. Body: { userId? } or { inviteId? } */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id: patientId } = await params;
    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body.userId === "string" ? body.userId : null;
    const inviteId = typeof body.inviteId === "string" ? body.inviteId : null;

    // Leave: non-owners can remove themselves
    if (targetUserId === userId) {
      const access = await getPatientAccess(patientId, userId);
      if (!access) {
        return NextResponse.json({ error: "Not a member", success: false }, { status: 404 });
      }
      if (access.role === "owner") {
        return NextResponse.json(
          { error: "Owners cannot leave — delete the patient or transfer ownership first", success: false },
          { status: 400 }
        );
      }
      await db
        .delete(patientMembers)
        .where(
          and(eq(patientMembers.patientId, patientId), eq(patientMembers.userId, userId))
        );
      return NextResponse.json({ success: true });
    }

    if (!(await canAccessPatient(patientId, userId, "owner"))) {
      return NextResponse.json({ error: "Forbidden", success: false }, { status: 403 });
    }

    if (inviteId) {
      await db
        .update(patientInvites)
        .set({ status: "revoked" })
        .where(and(eq(patientInvites.id, inviteId), eq(patientInvites.patientId, patientId)));
      return NextResponse.json({ success: true });
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Provide userId or inviteId", success: false },
        { status: 400 }
      );
    }

    const [member] = await db
      .select()
      .from(patientMembers)
      .where(
        and(
          eq(patientMembers.patientId, patientId),
          eq(patientMembers.userId, targetUserId)
        )
      )
      .limit(1);

    if (!member) {
      return NextResponse.json({ error: "Member not found", success: false }, { status: 404 });
    }
    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the owner", success: false },
        { status: 400 }
      );
    }

    await db.delete(patientMembers).where(eq(patientMembers.id, member.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
