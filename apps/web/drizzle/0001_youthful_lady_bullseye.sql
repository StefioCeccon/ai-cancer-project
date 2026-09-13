ALTER TYPE "public"."analysis_type" ADD VALUE 'ml_imaging';--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "strategy_recommendation" jsonb;--> statement-breakpoint
ALTER TABLE "imaging_instances" ADD COLUMN "flagged_for_ai" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "imaging_studies" ADD COLUMN "ml_model_results" jsonb;--> statement-breakpoint
ALTER TABLE "medical_reports" ADD COLUMN "imaging_study_id" uuid;--> statement-breakpoint
ALTER TABLE "medical_reports" ADD CONSTRAINT "medical_reports_imaging_study_id_imaging_studies_id_fk" FOREIGN KEY ("imaging_study_id") REFERENCES "public"."imaging_studies"("id") ON DELETE set null ON UPDATE no action;