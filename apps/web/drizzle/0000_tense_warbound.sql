CREATE TYPE "public"."ai_provider" AS ENUM('gemini', 'openai', 'anthropic', 'mistral');--> statement-breakpoint
CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."analysis_type" AS ENUM('cancer_progression', 'biomarker_trend', 'imaging_findings', 'treatment_response', 'risk_assessment', 'next_steps', 'comprehensive');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."imaging_modality" AS ENUM('CT', 'MRI', 'PET', 'XRAY', 'ULTRASOUND', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."marker_status" AS ENUM('normal', 'low', 'high', 'critical_low', 'critical_high');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('visit_note', 'pathology', 'radiology', 'discharge_summary', 'treatment_plan', 'prescription', 'referral', 'other');--> statement-breakpoint
CREATE TABLE "analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"analysis_type" "analysis_type" NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"status" "analysis_status" DEFAULT 'pending' NOT NULL,
	"prompt" text,
	"result" jsonb,
	"error_message" text,
	"duration_ms" integer,
	"input_data_ids" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "blood_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blood_test_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" real NOT NULL,
	"unit" text NOT NULL,
	"reference_min" real,
	"reference_max" real,
	"status" "marker_status" DEFAULT 'normal' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "blood_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"test_date" text NOT NULL,
	"lab_name" text,
	"requesting_physician" text,
	"raw_text" text,
	"file_path" text,
	"ai_interpretation" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imaging_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" uuid NOT NULL,
	"instance_number" integer NOT NULL,
	"sop_instance_uid" text,
	"file_path" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imaging_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"series_number" integer NOT NULL,
	"description" text,
	"modality" "imaging_modality" NOT NULL,
	"instance_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imaging_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"modality" "imaging_modality" NOT NULL,
	"study_date" text NOT NULL,
	"body_part" text NOT NULL,
	"description" text,
	"dicom_path" text,
	"thumbnail_path" text,
	"series_count" integer DEFAULT 0 NOT NULL,
	"instance_count" integer DEFAULT 0 NOT NULL,
	"radiologist_report" text,
	"ai_findings" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"report_type" "report_type" NOT NULL,
	"report_date" text NOT NULL,
	"author" text,
	"institution" text,
	"title" text NOT NULL,
	"raw_text" text,
	"file_path" text,
	"extracted_data" jsonb,
	"ai_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"gender" "gender" NOT NULL,
	"email" text,
	"phone" text,
	"diagnosis_date" text,
	"cancer_type" text,
	"cancer_stage" text,
	"primary_physician" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_markers" ADD CONSTRAINT "blood_markers_blood_test_id_blood_tests_id_fk" FOREIGN KEY ("blood_test_id") REFERENCES "public"."blood_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_tests" ADD CONSTRAINT "blood_tests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_instances" ADD CONSTRAINT "imaging_instances_series_id_imaging_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."imaging_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_series" ADD CONSTRAINT "imaging_series_study_id_imaging_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."imaging_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_studies" ADD CONSTRAINT "imaging_studies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_reports" ADD CONSTRAINT "medical_reports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;