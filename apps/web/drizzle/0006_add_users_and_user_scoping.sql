CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "blood_tests" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "imaging_studies" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "medical_reports" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "symptoms" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "therapies" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_tests" ADD CONSTRAINT "blood_tests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_studies" ADD CONSTRAINT "imaging_studies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_reports" ADD CONSTRAINT "medical_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapies" ADD CONSTRAINT "therapies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;