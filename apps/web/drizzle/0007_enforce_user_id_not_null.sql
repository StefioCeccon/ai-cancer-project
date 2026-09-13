ALTER TABLE "analysis_runs" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "blood_tests" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "imaging_studies" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "medical_reports" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "symptoms" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "therapies" ALTER COLUMN "user_id" SET NOT NULL;