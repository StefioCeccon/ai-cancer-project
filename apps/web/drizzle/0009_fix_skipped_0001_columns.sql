-- 0001 was missing from the drizzle journal, so fresh DBs (e.g. Neon) never got these columns.
-- Idempotent so it's safe on DBs that already applied the changes manually / via push.
ALTER TYPE "public"."analysis_type" ADD VALUE IF NOT EXISTS 'ml_imaging';--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN IF NOT EXISTS "strategy_recommendation" jsonb;--> statement-breakpoint
ALTER TABLE "imaging_instances" ADD COLUMN IF NOT EXISTS "flagged_for_ai" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "imaging_studies" ADD COLUMN IF NOT EXISTS "ml_model_results" jsonb;--> statement-breakpoint
ALTER TABLE "medical_reports" ADD COLUMN IF NOT EXISTS "imaging_study_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_reports" ADD CONSTRAINT "medical_reports_imaging_study_id_imaging_studies_id_fk" FOREIGN KEY ("imaging_study_id") REFERENCES "public"."imaging_studies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
