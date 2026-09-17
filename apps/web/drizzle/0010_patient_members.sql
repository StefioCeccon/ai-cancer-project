-- Shared patients: membership + email invites
CREATE TYPE "public"."patient_member_role" AS ENUM('owner', 'collaborator', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."patient_invite_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TABLE "patient_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "patient_member_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patient_members_patient_user_unique" UNIQUE("patient_id","user_id")
);--> statement-breakpoint
CREATE TABLE "patient_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "patient_member_role" NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"status" "patient_invite_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "patient_invites_patient_email_unique" UNIQUE("patient_id","email")
);--> statement-breakpoint
ALTER TABLE "patient_members" ADD CONSTRAINT "patient_members_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_members" ADD CONSTRAINT "patient_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_invites" ADD CONSTRAINT "patient_invites_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_invites" ADD CONSTRAINT "patient_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: each patient owner becomes an owner member
INSERT INTO "patient_members" ("patient_id", "user_id", "role")
SELECT "id", "user_id", 'owner'::"patient_member_role"
FROM "patients"
ON CONFLICT DO NOTHING;
