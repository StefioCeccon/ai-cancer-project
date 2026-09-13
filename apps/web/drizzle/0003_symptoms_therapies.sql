DO $$ BEGIN
 CREATE TYPE "public"."symptom_severity" AS ENUM('mild', 'moderate', 'severe');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."therapy_type" AS ENUM('chemotherapy', 'immunotherapy', 'radiation', 'surgery', 'targeted_therapy', 'hormone_therapy', 'supportive_care', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "symptoms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"severity" "symptom_severity",
	"start_date" text NOT NULL,
	"end_date" text,
	"notes" text,
	"raw_text" text,
	"file_path" text,
	"source_title" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "therapies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"therapy_type" "therapy_type" DEFAULT 'other' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"dosage" text,
	"frequency" text,
	"notes" text,
	"raw_text" text,
	"file_path" text,
	"source_title" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "therapy_medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"dosage" text,
	"frequency" text,
	"route" text,
	"notes" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "therapies" ADD CONSTRAINT "therapies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "therapy_medications" ADD CONSTRAINT "therapy_medications_therapy_id_therapies_id_fk" FOREIGN KEY ("therapy_id") REFERENCES "public"."therapies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
