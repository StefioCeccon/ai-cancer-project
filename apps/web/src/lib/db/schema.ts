import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  pgEnum,
  uuid,
  boolean,
  unique,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const imagingModalityEnum = pgEnum("imaging_modality", [
  "CT", "MRI", "PET", "XRAY", "ULTRASOUND", "OTHER",
]);
export const markerStatusEnum = pgEnum("marker_status", [
  "normal", "low", "high", "critical_low", "critical_high",
]);
export const reportTypeEnum = pgEnum("report_type", [
  "visit_note", "pathology", "radiology", "discharge_summary",
  "treatment_plan", "prescription", "referral", "other",
]);
export const aiProviderEnum = pgEnum("ai_provider", [
  "gemini", "openai", "anthropic", "mistral",
]);
export const analysisStatusEnum = pgEnum("analysis_status", [
  "pending", "running", "completed", "failed",
]);
export const analysisTypeEnum = pgEnum("analysis_type", [
  "cancer_progression", "biomarker_trend", "imaging_findings",
  "treatment_response", "risk_assessment", "next_steps", "comprehensive",
  "ml_imaging", "mdt_consultation",
]);
export const symptomSeverityEnum = pgEnum("symptom_severity", [
  "mild", "moderate", "severe",
]);
export const therapyTypeEnum = pgEnum("therapy_type", [
  "chemotherapy", "immunotherapy", "radiation", "surgery",
  "targeted_therapy", "hormone_therapy", "supportive_care", "other",
]);
export const patientMemberRoleEnum = pgEnum("patient_member_role", [
  "owner", "collaborator", "viewer",
]);
export const patientInviteStatusEnum = pgEnum("patient_invite_status", [
  "pending", "accepted", "revoked",
]);

// ─── Users (tenant root, keyed to Clerk) ──────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(), // internal id: usr_<uuid>
  clerkUserId: text("clerk_user_id").unique(),
  email: text("email").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Per-user AI provider API keys ────────────────────────────────────────────
// One key per (user, provider). The key is stored encrypted (AES-256-GCM); only
// the ciphertext and a short hint (last 4 chars) ever live in the DB.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    provider: aiProviderEnum("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    keyHint: text("key_hint"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userProviderUnique: unique("api_keys_user_provider_unique").on(t.userId, t.provider),
  }),
);

// ─── Patients ─────────────────────────────────────────────────────────────────
export const patients = pgTable("patients", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Tenant owner. Existing data was backfilled on first local sign-in, then enforced NOT NULL.
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  gender: genderEnum("gender").notNull(),
  email: text("email"),
  phone: text("phone"),
  diagnosisDate: text("diagnosis_date"),
  cancerType: text("cancer_type"),
  cancerStage: text("cancer_stage"),
  primaryPhysician: text("primary_physician"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Patient members (shared access) ──────────────────────────────────────────
export const patientMembers = pgTable(
  "patient_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    role: patientMemberRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    patientUserUnique: unique("patient_members_patient_user_unique").on(t.patientId, t.userId),
  }),
);

// Pending email invites (accepted automatically when invitee signs up)
export const patientInvites = pgTable(
  "patient_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
    email: text("email").notNull(),
    role: patientMemberRoleEnum("role").notNull(),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    status: patientInviteStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (t) => ({
    patientEmailUnique: unique("patient_invites_patient_email_unique").on(t.patientId, t.email),
  }),
);

// ─── Imaging Studies ──────────────────────────────────────────────────────────
export const imagingStudies = pgTable("imaging_studies", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  modality: imagingModalityEnum("modality").notNull(),
  studyDate: text("study_date").notNull(),
  bodyPart: text("body_part").notNull(),
  description: text("description"),
  dicomPath: text("dicom_path"),
  thumbnailPath: text("thumbnail_path"),
  seriesCount: integer("series_count").default(0).notNull(),
  instanceCount: integer("instance_count").default(0).notNull(),
  radiologistReport: text("radiologist_report"),
  aiFindings: text("ai_findings"),
  mlModelResults: jsonb("ml_model_results"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const imagingSeries = pgTable("imaging_series", {
  id: uuid("id").defaultRandom().primaryKey(),
  studyId: uuid("study_id").references(() => imagingStudies.id, { onDelete: "cascade" }).notNull(),
  seriesNumber: integer("series_number").notNull(),
  description: text("description"),
  modality: imagingModalityEnum("modality").notNull(),
  instanceCount: integer("instance_count").default(0).notNull(),
});

export const imagingInstances = pgTable("imaging_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  seriesId: uuid("series_id").references(() => imagingSeries.id, { onDelete: "cascade" }).notNull(),
  instanceNumber: integer("instance_number").notNull(),
  sopInstanceUid: text("sop_instance_uid"),
  filePath: text("file_path").notNull(),
  flaggedForAI: boolean("flagged_for_ai").default(false).notNull(),
});

// ─── Blood Tests ──────────────────────────────────────────────────────────────
export const bloodTests = pgTable("blood_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  testDate: text("test_date").notNull(),
  labName: text("lab_name"),
  requestingPhysician: text("requesting_physician"),
  rawText: text("raw_text"),
  filePath: text("file_path"),
  aiInterpretation: text("ai_interpretation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bloodMarkers = pgTable("blood_markers", {
  id: uuid("id").defaultRandom().primaryKey(),
  bloodTestId: uuid("blood_test_id").references(() => bloodTests.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  referenceMin: real("reference_min"),
  referenceMax: real("reference_max"),
  status: markerStatusEnum("status").notNull().default("normal"),
  notes: text("notes"),
});

// ─── Medical Reports ──────────────────────────────────────────────────────────
export const medicalReports = pgTable("medical_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  imagingStudyId: uuid("imaging_study_id").references(() => imagingStudies.id, { onDelete: "set null" }),
  reportType: reportTypeEnum("report_type").notNull(),
  reportDate: text("report_date").notNull(),
  author: text("author"),
  institution: text("institution"),
  title: text("title").notNull(),
  rawText: text("raw_text"),
  filePath: text("file_path"),
  extractedData: jsonb("extracted_data"),
  aiSummary: text("ai_summary"),
  clinicalSpecialty: text("clinical_specialty"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Symptoms ─────────────────────────────────────────────────────────────────
export const symptoms = pgTable("symptoms", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  severity: symptomSeverityEnum("severity"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  notes: text("notes"),
  rawText: text("raw_text"),
  filePath: text("file_path"),
  sourceTitle: text("source_title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Therapies ────────────────────────────────────────────────────────────────
export const therapies = pgTable("therapies", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  therapyType: therapyTypeEnum("therapy_type").notNull().default("other"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  dosage: text("dosage"),
  frequency: text("frequency"),
  notes: text("notes"),
  rawText: text("raw_text"),
  filePath: text("file_path"),
  sourceTitle: text("source_title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const therapyMedications = pgTable("therapy_medications", {
  id: uuid("id").defaultRandom().primaryKey(),
  therapyId: uuid("therapy_id").references(() => therapies.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  startDate: text("start_date"),
  dosage: text("dosage"),
  frequency: text("frequency"),
  route: text("route"),
  notes: text("notes"),
});

// ─── Analysis Runs ────────────────────────────────────────────────────────────
export const analysisRuns = pgTable("analysis_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  analysisType: analysisTypeEnum("analysis_type").notNull(),
  provider: aiProviderEnum("provider").notNull(),
  model: text("model").notNull(),
  status: analysisStatusEnum("status").notNull().default("pending"),
  prompt: text("prompt"),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  inputDataIds: jsonb("input_data_ids").notNull().default("{}"),
  strategyRecommendation: jsonb("strategy_recommendation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ApiKeyInsert = typeof apiKeys.$inferInsert;
export type Patient = typeof patients.$inferSelect;
export type PatientInsert = typeof patients.$inferInsert;
export type ImagingStudy = typeof imagingStudies.$inferSelect;
export type ImagingStudyInsert = typeof imagingStudies.$inferInsert;
export type BloodTest = typeof bloodTests.$inferSelect;
export type BloodTestInsert = typeof bloodTests.$inferInsert;
export type BloodMarker = typeof bloodMarkers.$inferSelect;
export type BloodMarkerInsert = typeof bloodMarkers.$inferInsert;
export type MedicalReport = typeof medicalReports.$inferSelect;
export type MedicalReportInsert = typeof medicalReports.$inferInsert;
export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type AnalysisRunInsert = typeof analysisRuns.$inferInsert;
export type Symptom = typeof symptoms.$inferSelect;
export type SymptomInsert = typeof symptoms.$inferInsert;
export type Therapy = typeof therapies.$inferSelect;
export type TherapyInsert = typeof therapies.$inferInsert;
export type TherapyMedication = typeof therapyMedications.$inferSelect;
export type TherapyMedicationInsert = typeof therapyMedications.$inferInsert;
export type PatientMember = typeof patientMembers.$inferSelect;
export type PatientMemberInsert = typeof patientMembers.$inferInsert;
export type PatientInvite = typeof patientInvites.$inferSelect;
export type PatientInviteInsert = typeof patientInvites.$inferInsert;
export type PatientMemberRole = (typeof patientMemberRoleEnum.enumValues)[number];
export type PatientInviteStatus = (typeof patientInviteStatusEnum.enumValues)[number];
