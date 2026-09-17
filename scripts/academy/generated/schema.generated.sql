-- GENERATED FILE — do not edit by hand.

-- Source: production PostgREST schema spec (schema metadata only, zero rows read).

-- Regenerate with: npm run academy:provision

--

-- This is a CAPTURE database: its only job is to render screens for screenshots

-- and video. It is deliberately NOT a faithful copy of production:

--   * NOT NULL is not reproduced (except implicit primary keys)

--   * no triggers, no check constraints beyond enums, no functions

-- Both make inserts more permissive, which is what we want here and would be

-- wrong anywhere else. Never point an application at this database.

-- Tables: 105 | Enums: 17 | PKs: 102 | FKs: 163 | Skipped: 14

-- Skipped (views are in views.sql; tmp_* are historical import staging): tmp_appointments, tmp_axenita_invoice_lines, tmp_catalog_codes, tmp_contacts, tmp_deals, tmp_invoice_import, tmp_invoice_raw, tmp_notes, tmp_patient_axenita, tmp_patient_with_address_and_ssn, tmp_treatment_flat, v_debiteurs, v_invoice_lines_enriched, v_invoices_enriched



CREATE EXTENSION IF NOT EXISTS pgcrypto;



-- Enum types

DO $$ BEGIN
  CREATE TYPE public."consultation_record_type" AS ENUM ('notes', 'prescription', 'invoice', 'file', 'photo', 'patient_information', 'documents', 'form_photos', '3d', 'medication');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."chat_message_role" AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."knowledge_message_role" AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."task_status" AS ENUM ('not_started', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."task_priority" AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."task_type" AS ENUM ('todo', 'call', 'email', 'other', 'consultation', 'meeting');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."workflow_action_type" AS ENUM ('draft_email_patient', 'draft_email_insurance', 'generate_postop_doc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."appointment_status" AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."webhook_status" AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."email_template_type" AS ENUM ('patient', 'insurance', 'post_op', 'workflow');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."workflow_trigger_type" AS ENUM ('deal_stage_changed', 'appointment_created', 'appointment_updated', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."email_status" AS ENUM ('draft', 'queued', 'sent', 'failed', 'read', 'opened', 'dropped', 'delivered', 'received', 'sending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."email_direction" AS ENUM ('outbound', 'inbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."document_type" AS ENUM ('post_op', 'report', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."whatsapp_status" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'read');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."whatsapp_direction" AS ENUM ('outbound', 'inbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."deal_stage_type" AS ENUM ('lead', 'consultation', 'surgery', 'post_op', 'follow_up', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;



-- Tables

CREATE TABLE IF NOT EXISTS public."appointment_categories" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "color" text DEFAULT 'bg-slate-300/70',
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."appointment_history" (
  "id" uuid DEFAULT gen_random_uuid(),
  "appointment_id" uuid,
  "changed_by_user_id" uuid,
  "changed_by_email" text,
  "changed_at" timestamp with time zone DEFAULT now(),
  "change_type" text,
  "original_start_time" timestamp with time zone,
  "original_end_time" timestamp with time zone,
  "original_status" text,
  "original_location" text,
  "new_start_time" timestamp with time zone,
  "new_end_time" timestamp with time zone,
  "new_status" text,
  "new_location" text,
  "notes" text,
  "original_reason" text,
  "original_patient_id" uuid,
  "original_doctor" text,
  "new_doctor" text,
  "original_service" text,
  "new_service" text,
  "new_reason" text
);

CREATE TABLE IF NOT EXISTS public."appointments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "provider_id" uuid,
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone,
  "status" public.appointment_status DEFAULT 'scheduled'::public.appointment_status,
  "reason" text,
  "location" text,
  "source" text DEFAULT 'manual',
  "created_at" timestamp with time zone DEFAULT now(),
  "is_demo" boolean DEFAULT false,
  "category" text,
  "temporary_text" text,
  "migrated" boolean DEFAULT false,
  "notes" text,
  "title" text,
  "no_patient" boolean DEFAULT false,
  "reminder_sent_at" timestamp with time zone,
  "booking_confirmation_sent_at" timestamp with time zone,
  "doctor_user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."appx_sessions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "patient_id" uuid,
  "started_at" timestamp with time zone DEFAULT now(),
  "ended_at" timestamp with time zone,
  "commands" jsonb,
  "changes" jsonb,
  "summary" text,
  "status" text DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."article_distributions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "article_id" text,
  "service" text DEFAULT 'prnow',
  "external_id" text,
  "status" text DEFAULT 'draft',
  "title" text,
  "placements_count" integer DEFAULT 0,
  "report_url" text,
  "submitted_at" timestamp with time zone DEFAULT now(),
  "completed_at" timestamp with time zone,
  "cost" numeric DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."bank_payment_import_items" (
  "id" uuid DEFAULT gen_random_uuid(),
  "import_id" uuid,
  "booking_date" date,
  "amount" numeric,
  "currency" text DEFAULT 'CHF',
  "reference_number" text,
  "debtor_name" text,
  "ultimate_debtor_name" text,
  "debtor_iban" text,
  "description" text,
  "bank_reference" text,
  "end_to_end_id" text,
  "credit_debit" text,
  "match_status" text DEFAULT 'unmatched',
  "match_notes" text,
  "matched_invoice_id" uuid,
  "matched_installment_id" uuid,
  "matched_invoice_number" text,
  "previous_paid_amount" numeric,
  "new_paid_amount" numeric
);

CREATE TABLE IF NOT EXISTS public."bank_payment_imports" (
  "id" uuid DEFAULT gen_random_uuid(),
  "file_name" text,
  "file_url" text,
  "imported_at" timestamp with time zone DEFAULT now(),
  "imported_by_user_id" uuid,
  "imported_by_name" text,
  "total_transactions" integer DEFAULT 0,
  "matched_count" integer DEFAULT 0,
  "unmatched_count" integer DEFAULT 0,
  "already_paid_count" integer DEFAULT 0,
  "overpaid_count" integer DEFAULT 0,
  "underpaid_count" integer DEFAULT 0,
  "total_amount" numeric DEFAULT 0,
  "matched_amount" numeric DEFAULT 0,
  "message_id" text,
  "iban" text,
  "bank_name" text,
  "statement_date_from" text,
  "statement_date_to" text,
  "status" text DEFAULT 'completed',
  "error_message" text
);

CREATE TABLE IF NOT EXISTS public."booking_blocked_dates" (
  "id" uuid DEFAULT gen_random_uuid(),
  "blocked_date" date,
  "reason" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."booking_doctor_days_off" (
  "slug" text,
  "days_off" smallint[],
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."call_logs" (
  "id" uuid DEFAULT gen_random_uuid(),
  "call_id" text,
  "patient_id" uuid,
  "deal_id" uuid,
  "direction" text,
  "agent_id" text,
  "from_number" text,
  "to_number" text,
  "call_status" text,
  "disconnection_reason" text,
  "duration_seconds" integer,
  "summary" text,
  "transcript" text,
  "transcript_turns" jsonb,
  "recording_url" text,
  "service_interest" text,
  "task_id" uuid,
  "assigned_user_id" uuid,
  "assigned_user_name" text,
  "source" text DEFAULT 'retell',
  "started_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "whatsapp_sent_at" timestamp with time zone,
  "scheduled_call_id" uuid,
  "prompt" text,
  "contact_status" text DEFAULT 'pending',
  "contact_resolved_at" timestamp with time zone,
  "contact_resolved_by" uuid
);

CREATE TABLE IF NOT EXISTS public."chat_conversations" (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "folder_id" uuid,
  "title" text,
  "patient_id" uuid,
  "deal_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "is_archived" boolean DEFAULT false,
  "archived_at" timestamp with time zone,
  "is_demo" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."chat_folders" (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "name" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."chat_messages" (
  "id" uuid DEFAULT gen_random_uuid(),
  "conversation_id" uuid,
  "role" public.chat_message_role,
  "content" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "is_demo" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."clinic_onboarding_submissions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "token_id" uuid,
  "status" text DEFAULT 'in_progress',
  "current_step" integer DEFAULT 1,
  "practice_name" text,
  "practice_location" text,
  "practice_address" text,
  "practice_phone" text,
  "practice_email" text,
  "practice_website" text,
  "main_contact_name" text,
  "main_contact_email" text,
  "main_contact_phone" text,
  "main_contact_role" text,
  "expected_user_count" integer,
  "user_directory" jsonb,
  "access_levels" jsonb,
  "departments" jsonb,
  "current_software" text,
  "current_software_other" text,
  "data_access_authorized" boolean DEFAULT false,
  "migration_contact_name" text,
  "migration_contact_email" text,
  "storage_estimate" text,
  "patient_file_count" integer,
  "service_categories" jsonb,
  "services_list" jsonb,
  "services_file_url" text,
  "lead_sources" jsonb,
  "marketing_automations" jsonb,
  "additional_notes" text,
  "gdpr_consent" boolean DEFAULT false,
  "hipaa_acknowledgment" boolean DEFAULT false,
  "terms_accepted" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."clinic_onboarding_tokens" (
  "id" uuid DEFAULT gen_random_uuid(),
  "email" text,
  "token" text,
  "expires_at" timestamp with time zone,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."consultations" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "consultation_id" text,
  "title" text,
  "record_type" public.consultation_record_type,
  "doctor_user_id" uuid,
  "doctor_name" text,
  "scheduled_at" timestamp with time zone,
  "payment_method" text,
  "created_by_user_id" uuid,
  "created_by_name" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "content" text,
  "duration_seconds" integer,
  "is_archived" boolean DEFAULT false,
  "archived_at" timestamp with time zone,
  "invoice_total_amount" numeric,
  "invoice_is_complimentary" boolean DEFAULT false,
  "invoice_is_paid" boolean DEFAULT false,
  "cash_receipt_path" text,
  "payment_link_token" text,
  "payment_link_expires_at" timestamp with time zone,
  "invoice_pdf_path" text,
  "stripe_payment_intent_id" text,
  "payment_completed_at" timestamp with time zone,
  "is_demo" boolean DEFAULT false,
  "payrexx_gateway_id" integer,
  "payrexx_gateway_hash" text,
  "payrexx_payment_link" text,
  "payrexx_transaction_id" integer,
  "payrexx_transaction_uuid" text,
  "payrexx_payment_status" text,
  "payrexx_paid_at" timestamp with time zone,
  "raw_data" text,
  "axenita_invoice_id" text,
  "invoice_status" text,
  "paid_at" timestamp with time zone,
  "paid_by_user_id" uuid,
  "insurance_payment_status" text,
  "insurance_paid_amount" numeric,
  "insurance_paid_date" date,
  "treatment_id" text,
  "attatched_treatment_title_id" text,
  "treatment_title_id" text,
  "invoice_paid_amount" double precision,
  "diagnosis_code" text,
  "ref_icd10" text
);

CREATE TABLE IF NOT EXISTS public."crisalix_reconstructions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "crisalix_patient_id" integer,
  "reconstruction_type" text,
  "player_id" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."deal_notifications" (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "deal_id" uuid,
  "patient_id" uuid,
  "notification_type" text,
  "old_stage_id" uuid,
  "new_stage_id" uuid,
  "old_stage_name" text,
  "new_stage_name" text,
  "changed_by_user_id" uuid,
  "changed_by_name" text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."deal_stages" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "type" public.deal_stage_type DEFAULT 'other'::public.deal_stage_type,
  "sort_order" integer,
  "is_default" boolean DEFAULT false,
  "is_demo" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."deals" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "stage_id" uuid,
  "title" text,
  "value" numeric,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "pipeline" text,
  "contact_label" text,
  "location" text,
  "service_id" uuid,
  "is_demo" boolean DEFAULT false,
  "owner_id" uuid,
  "owner_name" text
);

CREATE TABLE IF NOT EXISTS public."distribution_backlinks" (
  "id" uuid DEFAULT gen_random_uuid(),
  "distribution_id" uuid,
  "source_url" text,
  "source_domain" text,
  "anchor_text" text,
  "target_url" text,
  "domain_authority" integer,
  "is_dofollow" boolean DEFAULT true,
  "first_seen" timestamp with time zone DEFAULT now(),
  "last_checked" timestamp with time zone DEFAULT now(),
  "is_live" boolean DEFAULT true,
  "metadata" jsonb
);

CREATE TABLE IF NOT EXISTS public."distribution_stats" (
  "total_distributions" bigint,
  "completed" bigint,
  "pending" bigint,
  "failed" bigint,
  "total_placements" bigint,
  "total_cost" numeric,
  "active_backlinks" bigint
);

CREATE TABLE IF NOT EXISTS public."doctor_scheduling_settings" (
  "id" uuid DEFAULT gen_random_uuid(),
  "provider_id" uuid,
  "time_interval_minutes" integer DEFAULT 15,
  "default_duration_minutes" integer DEFAULT 15,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."document_templates" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "description" text,
  "file_path" text,
  "file_type" text DEFAULT 'docx',
  "category" text,
  "is_active" boolean DEFAULT true,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."documents" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "deal_id" uuid,
  "type" public.document_type DEFAULT 'other'::public.document_type,
  "title" text,
  "content" text,
  "created_by_user_id" uuid,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "is_demo" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."dropped_call_round_robin" (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "is_active" boolean DEFAULT true,
  "last_assigned_at" timestamp with time zone,
  "assignment_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."dropped_calls" (
  "id" uuid DEFAULT gen_random_uuid(),
  "retell_call_id" text,
  "from_number" text,
  "to_number" text,
  "call_duration_seconds" integer,
  "disconnection_reason" text,
  "transcript" text,
  "patient_id" uuid,
  "deal_id" uuid,
  "task_id" uuid,
  "assigned_to" uuid,
  "assignment_method" text DEFAULT 'round_robin',
  "status" text DEFAULT 'pending',
  "resolution_notes" text,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."email_attachments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "email_id" uuid,
  "file_name" text,
  "storage_path" text,
  "mime_type" text,
  "file_size" bigint,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."email_reply_notifications" (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "patient_id" uuid,
  "original_email_id" uuid,
  "reply_email_id" uuid,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."email_templates" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "type" public.email_template_type,
  "subject_template" text,
  "body_template" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "design_json" jsonb,
  "html_content" text,
  "updated_at" timestamp with time zone DEFAULT now(),
  "is_demo" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."emails" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "deal_id" uuid,
  "to_address" text,
  "from_address" text,
  "subject" text,
  "body" text,
  "status" public.email_status DEFAULT 'draft'::public.email_status,
  "direction" public.email_direction DEFAULT 'outbound'::public.email_direction,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "message_id" text,
  "is_demo" boolean DEFAULT false,
  "read_at" timestamp with time zone,
  "cc_address" text,
  "source" text DEFAULT 'manual',
  "sent_by_user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."embed_form_leads" (
  "id" uuid DEFAULT gen_random_uuid(),
  "first_name" text,
  "last_name" text,
  "email" text,
  "phone" text,
  "country_code" text DEFAULT '+41',
  "service" text,
  "location" text,
  "message" text,
  "is_existing_patient" boolean DEFAULT false,
  "form_type" text,
  "source_url" text,
  "referrer" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_term" text,
  "utm_content" text,
  "status" text DEFAULT 'new',
  "converted_to_patient_id" uuid,
  "converted_to_appointment_id" uuid,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "gclid" text,
  "gbraid" text,
  "wbraid" text,
  "fbclid" text,
  "msclkid" text,
  "ttclid" text,
  "landing_page" text
);

CREATE TABLE IF NOT EXISTS public."external_labs" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "url" text,
  "username" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "type" text DEFAULT 'medisupport_fr'
);

CREATE TABLE IF NOT EXISTS public."invoice_installments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "invoice_id" uuid,
  "installment_number" integer,
  "amount" numeric,
  "due_date" date,
  "payment_method" text,
  "status" text DEFAULT 'PENDING',
  "paid_amount" numeric DEFAULT 0,
  "paid_at" timestamp with time zone,
  "reference_number" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "payrexx_gateway_id" integer,
  "payrexx_gateway_hash" text,
  "payrexx_payment_link" text,
  "payrexx_payment_status" text,
  "payrexx_transaction_id" text,
  "payrexx_paid_at" timestamp with time zone,
  "invoice_number" text
);

CREATE TABLE IF NOT EXISTS public."invoice_line_items" (
  "id" uuid DEFAULT gen_random_uuid(),
  "invoice_id" uuid,
  "sort_order" integer DEFAULT 1,
  "code" text,
  "service_id" uuid,
  "name" text,
  "quantity" numeric DEFAULT 1,
  "unit_price" numeric,
  "discount_percent" numeric DEFAULT 0,
  "total_price" numeric,
  "vat_rate" text DEFAULT 'FREE',
  "vat_rate_value" numeric DEFAULT 0,
  "vat_amount" numeric DEFAULT 0,
  "tariff_code" integer,
  "tardoc_code" text,
  "tardoc_time" integer DEFAULT 0,
  "tp_al" numeric DEFAULT 0,
  "tp_tl" numeric DEFAULT 0,
  "tp_al_value" numeric DEFAULT 1,
  "tp_tl_value" numeric DEFAULT 1,
  "tp_al_scale_factor" numeric DEFAULT 1,
  "tp_tl_scale_factor" numeric DEFAULT 1,
  "price_al" numeric DEFAULT 0,
  "price_tl" numeric DEFAULT 0,
  "catalog_name" text,
  "catalog_nature" text,
  "catalog_version" text,
  "uncovered_benefit" boolean DEFAULT false,
  "comment" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "date_begin" timestamp with time zone,
  "provider_gln" text,
  "responsible_gln" text,
  "billing_role" text DEFAULT 'both',
  "record_id" integer,
  "ref_code" text,
  "section_code" text,
  "session_number" integer DEFAULT 1,
  "service_attributes" integer DEFAULT 0,
  "external_factor_mt" numeric DEFAULT 1,
  "external_factor_tt" numeric DEFAULT 1,
  "side_type" integer DEFAULT 0,
  "tariff_type" text
);

CREATE TABLE IF NOT EXISTS public."invoice_payments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "invoice_id" uuid,
  "amount" numeric,
  "payment_method" text,
  "payment_date" date DEFAULT CURRENT_DATE,
  "payrexx_transaction_id" text,
  "insurance_response_code" text,
  "insurance_response_message" text,
  "notes" text,
  "created_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "fee_amount" numeric
);

CREATE TABLE IF NOT EXISTS public."invoices" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "consultation_id" uuid,
  "invoice_number" text,
  "invoice_date" date DEFAULT CURRENT_DATE,
  "due_date" date,
  "treatment_date" timestamp with time zone,
  "doctor_user_id" uuid,
  "doctor_name" text,
  "provider_id" uuid,
  "provider_name" text,
  "provider_gln" text,
  "provider_zsr" text,
  "subtotal" numeric DEFAULT 0,
  "vat_amount" numeric DEFAULT 0,
  "total_amount" numeric DEFAULT 0,
  "paid_amount" numeric DEFAULT 0,
  "status" text DEFAULT 'OPEN',
  "is_complimentary" boolean DEFAULT false,
  "payment_method" text,
  "payment_link_token" text,
  "payment_link_expires_at" timestamp with time zone,
  "payrexx_gateway_id" integer,
  "payrexx_gateway_hash" text,
  "payrexx_payment_link" text,
  "payrexx_transaction_id" text,
  "payrexx_transaction_uuid" text,
  "payrexx_payment_status" text,
  "payrexx_paid_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "paid_by_user_id" uuid,
  "pdf_path" text,
  "pdf_generated_at" timestamp with time zone,
  "cash_receipt_path" text,
  "health_insurance_law" text,
  "billing_type" text DEFAULT 'TG',
  "insurer_id" uuid,
  "medical_case_number" text,
  "medidata_submission_id" uuid,
  "insurance_payment_status" text,
  "insurance_paid_amount" numeric,
  "insurance_paid_date" date,
  "created_by_user_id" uuid,
  "created_by_name" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "is_archived" boolean DEFAULT false,
  "archived_at" timestamp with time zone,
  "is_demo" boolean DEFAULT false,
  "treatment_canton" text,
  "treatment_reason" text DEFAULT 'disease',
  "treatment_date_end" timestamp with time zone,
  "diagnosis_codes" jsonb,
  "insurance_gln" text,
  "insurance_name" text,
  "patient_ssn" text,
  "patient_card_number" text,
  "copy_to_guarantor" boolean DEFAULT false,
  "provider_iban" text,
  "doctor_gln" text,
  "doctor_zsr" text,
  "doctor_canton" text,
  "reminder_level" integer DEFAULT 0,
  "accident_date" date,
  "title" text,
  "reference_number" text,
  "parent_invoice_id" uuid,
  "installment_id" uuid,
  "email_sent_at" timestamp with time zone,
  "reminder_fees" numeric DEFAULT 0,
  "payrexx_fee_amount" numeric
);

CREATE TABLE IF NOT EXISTS public."knowledge_attachments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "message_id" uuid,
  "topic_id" uuid,
  "file_name" text,
  "file_type" text,
  "file_size" integer,
  "mime_type" text,
  "storage_path" text,
  "thumbnail_path" text,
  "extracted_text" text,
  "is_processed" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."knowledge_messages" (
  "id" uuid DEFAULT gen_random_uuid(),
  "topic_id" uuid,
  "role" public.knowledge_message_role,
  "content" text,
  "has_attachments" boolean DEFAULT false,
  "model_used" text,
  "tokens_used" integer,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."knowledge_topics" (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "title" text DEFAULT 'New Topic',
  "description" text,
  "icon" text DEFAULT 'sparkles',
  "color" text DEFAULT 'sky',
  "is_pinned" boolean DEFAULT false,
  "is_archived" boolean DEFAULT false,
  "message_count" integer DEFAULT 0,
  "attachment_count" integer DEFAULT 0,
  "last_message_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."lead_imports" (
  "id" uuid DEFAULT gen_random_uuid(),
  "filename" text,
  "service" text,
  "total_leads" integer DEFAULT 0,
  "imported_count" integer DEFAULT 0,
  "failed_count" integer DEFAULT 0,
  "imported_patient_ids" uuid[],
  "errors" text[],
  "import_date" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."legacy_patient_doc_folders" (
  "patient_id" uuid,
  "folder_name" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."marketing_campaign_recipients" (
  "id" uuid DEFAULT gen_random_uuid(),
  "campaign_id" uuid,
  "patient_id" uuid,
  "email" text,
  "status" text DEFAULT 'pending',
  "email_id" uuid,
  "error" text,
  "sent_at" timestamp with time zone,
  "opened_at" timestamp with time zone,
  "processing_started_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."marketing_campaigns" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "list_id" uuid,
  "filter_snapshot" jsonb,
  "template_id" uuid,
  "subject" text,
  "html_snapshot" text,
  "status" text DEFAULT 'draft',
  "total_recipients" integer DEFAULT 0,
  "total_sent" integer DEFAULT 0,
  "total_failed" integer DEFAULT 0,
  "total_opened" integer DEFAULT 0,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "notification_read_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."marketing_lists" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "description" text,
  "filter" jsonb,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."medical_records" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "ap_content" text DEFAULT '',
  "af_content" text DEFAULT '',
  "notes_content" text DEFAULT '',
  "ap_file_path" text,
  "af_file_path" text,
  "notes_file_path" text,
  "source_folder" text,
  "imported_from_storage" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "last_edited_by" uuid,
  "last_edited_by_name" text
);

CREATE TABLE IF NOT EXISTS public."medication_template_items" (
  "id" uuid DEFAULT gen_random_uuid(),
  "template_id" uuid,
  "product_name" text,
  "product_number" integer,
  "product_type" text DEFAULT 'MEDICATION',
  "intake_kind" text DEFAULT 'FIXED',
  "amount_morning" text,
  "amount_noon" text,
  "amount_evening" text,
  "amount_night" text,
  "quantity" integer DEFAULT 1,
  "intake_note" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."medication_templates" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "description" text,
  "service_id" uuid,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."medidata_config" (
  "id" uuid DEFAULT gen_random_uuid(),
  "clinic_gln" text,
  "medidata_client_id" text,
  "is_test_mode" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."medidata_notifications_log" (
  "id" uuid DEFAULT gen_random_uuid(),
  "medidata_notification_id" bigint,
  "severity" text,
  "error_code" text,
  "message" text,
  "transmission_reference" text,
  "submission_id" uuid,
  "confirmed_at" timestamp with time zone,
  "medidata_created_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."medidata_responses" (
  "id" uuid DEFAULT gen_random_uuid(),
  "medidata_message_id" text,
  "document_reference" text,
  "correlation_reference" text,
  "submission_id" uuid,
  "response_type" text,
  "status_in" text,
  "status_out" text,
  "sender_gln" text,
  "receiver_gln" text,
  "content" text,
  "raw_data" jsonb,
  "explanation" text,
  "received_at" timestamp with time zone,
  "processed_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "document_path" text
);

CREATE TABLE IF NOT EXISTS public."medidata_submission_history" (
  "id" uuid DEFAULT gen_random_uuid(),
  "submission_id" uuid,
  "previous_status" text,
  "new_status" text,
  "response_code" text,
  "response_message" text,
  "changed_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "notes" text
);

CREATE TABLE IF NOT EXISTS public."medidata_submissions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "consultation_id" uuid,
  "patient_id" uuid,
  "insurer_id" uuid,
  "invoice_number" text,
  "invoice_date" date,
  "invoice_amount" numeric,
  "billing_type" text,
  "law_type" text,
  "xml_content" text,
  "xml_version" text DEFAULT 4.50,
  "medidata_message_id" text,
  "medidata_transmission_date" timestamp with time zone,
  "medidata_response_code" text,
  "medidata_response_message" text,
  "status" text DEFAULT 'draft',
  "insurance_response_date" timestamp with time zone,
  "insurance_response_code" text,
  "insurance_response_message" text,
  "insurance_paid_amount" numeric,
  "insurance_paid_date" date,
  "patient_portion_amount" numeric,
  "patient_portion_paid" boolean DEFAULT false,
  "patient_portion_paid_date" date,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "invoice_id" uuid,
  "patient_copy_ref" text,
  "is_storno" boolean DEFAULT false,
  "parent_submission_id" uuid,
  "storno_reason" text
);

CREATE TABLE IF NOT EXISTS public."patient_consultation_data" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "submission_id" uuid,
  "consultation_type" text,
  "selected_areas" text[],
  "measurements" jsonb,
  "upload_mode" text DEFAULT 'later',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "breast_data" jsonb,
  "face_data" jsonb
);

CREATE TABLE IF NOT EXISTS public."patient_document_versions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "document_id" uuid,
  "version" integer,
  "content" text,
  "changed_by" uuid,
  "changed_by_name" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patient_documents" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "template_id" uuid,
  "title" text,
  "content" text,
  "status" text DEFAULT 'draft',
  "file_path" text,
  "version" integer DEFAULT 1,
  "created_by" uuid,
  "created_by_name" text,
  "last_edited_by" uuid,
  "last_edited_at" timestamp with time zone,
  "signed_at" timestamp with time zone,
  "signed_by_patient" boolean DEFAULT false,
  "signed_by_doctor" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "docspace_file_id" text
);

CREATE TABLE IF NOT EXISTS public."patient_edit_locks" (
  "patient_id" uuid,
  "user_id" uuid,
  "user_name" text,
  "user_avatar_url" text,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patient_form_submissions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "form_id" text,
  "form_name" text,
  "submission_data" jsonb,
  "submitted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "status" text DEFAULT 'pending',
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "notes" text,
  "token" text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text),
  "expires_at" timestamp with time zone DEFAULT (now() + '30 days'::interval)
);

CREATE TABLE IF NOT EXISTS public."patient_health_background" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "submission_id" uuid,
  "weight_kg" numeric,
  "height_cm" numeric,
  "bmi" numeric,
  "known_illnesses" text,
  "previous_surgeries" text,
  "allergies" text,
  "medications" text,
  "cigarettes" text,
  "alcohol_consumption" text,
  "sports_activity" text,
  "general_practitioner" text,
  "gynecologist" text,
  "children_count" integer,
  "birth_type_1" text,
  "birth_type_2" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patient_insurances" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "provider_name" text,
  "card_number" text,
  "insurance_type" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "insurer_id" uuid,
  "gln" text,
  "avs_number" text,
  "policy_number" text,
  "law_type" text,
  "billing_type" text DEFAULT 'TG',
  "case_number" text,
  "accident_date" date,
  "is_primary" boolean DEFAULT true,
  "insurer_gln" text,
  "valid_from" timestamp without time zone,
  "valid_till" timestamp without time zone,
  "kvg_insurance_model" text,
  "email" text
);

CREATE TABLE IF NOT EXISTS public."patient_intake_photos" (
  "id" uuid DEFAULT gen_random_uuid(),
  "submission_id" uuid,
  "patient_id" uuid,
  "photo_type" text,
  "area_name" text,
  "storage_path" text,
  "file_name" text,
  "mime_type" text,
  "file_size" integer,
  "uploaded_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patient_intake_preferences" (
  "id" uuid DEFAULT gen_random_uuid(),
  "submission_id" uuid,
  "patient_id" uuid,
  "preferred_language" text DEFAULT 'en',
  "consultation_type" text,
  "preferred_contact_method" text,
  "preferred_contact_time" text,
  "additional_notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patient_intake_submissions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "status" text DEFAULT 'in_progress',
  "current_step" integer DEFAULT 1,
  "started_at" timestamp with time zone DEFAULT now(),
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "consultation_category" text
);

CREATE TABLE IF NOT EXISTS public."patient_measurements" (
  "id" uuid DEFAULT gen_random_uuid(),
  "submission_id" uuid,
  "patient_id" uuid,
  "height_cm" numeric,
  "weight_kg" numeric,
  "bmi" numeric,
  "chest_cm" numeric,
  "waist_cm" numeric,
  "hips_cm" numeric,
  "other_measurements" jsonb,
  "measured_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patient_merge_logs" (
  "id" uuid DEFAULT gen_random_uuid(),
  "primary_patient_id" uuid,
  "primary_patient_name" text,
  "merged_patient_ids" uuid[],
  "merged_patient_names" text[],
  "performed_by_user_id" uuid,
  "performed_by_name" text,
  "tables_updated" text[],
  "files_copied" integer DEFAULT 0,
  "file_mappings" jsonb,
  "status" text DEFAULT 'success',
  "error_message" text,
  "started_at" timestamp with time zone DEFAULT now(),
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patient_note_mentions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "note_id" uuid,
  "patient_id" uuid,
  "mentioned_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "read_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."patient_notes" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "author_user_id" uuid,
  "author_name" text,
  "body" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "is_demo" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."patient_prescriptions" (
  "journal_entry_id" uuid,
  "patient_id" uuid,
  "mandator_id" text,
  "therapy_id" uuid,
  "prescription_line_id" uuid,
  "prescription_sheet_id" uuid,
  "ui_destination_tab" character varying,
  "product_name" character varying,
  "product_no" character varying,
  "product_type" character varying,
  "product_state" character varying,
  "amount_morning" character varying,
  "amount_noon" character varying,
  "amount_evening" character varying,
  "amount_night" character varying,
  "custom_dose" text,
  "quantity" character varying,
  "intake_kind" character varying,
  "intake_note" text,
  "intake_from_date" timestamp with time zone,
  "decision_summary" text,
  "show_in_mediplan" boolean DEFAULT false,
  "active" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "id" uuid DEFAULT gen_random_uuid(),
  "last_emailed_at" timestamp with time zone,
  "created_by" uuid
);

CREATE TABLE IF NOT EXISTS public."patient_simulations" (
  "id" uuid DEFAULT gen_random_uuid(),
  "submission_id" uuid,
  "patient_id" uuid,
  "simulation_type" text,
  "simulation_url" text,
  "storage_path" text,
  "status" text DEFAULT 'pending',
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patient_treatment_areas" (
  "id" uuid DEFAULT gen_random_uuid(),
  "submission_id" uuid,
  "patient_id" uuid,
  "area_name" text,
  "area_category" text,
  "specific_concerns" text[],
  "priority" integer DEFAULT 1,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patient_treatment_preferences" (
  "id" uuid DEFAULT gen_random_uuid(),
  "submission_id" uuid,
  "patient_id" uuid,
  "interested_treatments" text[],
  "preferred_date_range_start" date,
  "preferred_date_range_end" date,
  "flexibility" text,
  "budget_range" text,
  "financing_interest" boolean DEFAULT false,
  "special_requests" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patients" (
  "id" uuid DEFAULT gen_random_uuid(),
  "first_name" text,
  "last_name" text,
  "email" text,
  "phone" text,
  "dob" date,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "source" text DEFAULT 'manual',
  "marital_status" text,
  "nationality" text,
  "street_address" text,
  "postal_code" text,
  "town" text,
  "profession" text,
  "current_employer" text,
  "gender" text,
  "avatar_url" text,
  "language_preference" text,
  "clinic_preference" text,
  "lifecycle_stage" text,
  "contact_owner_name" text,
  "contact_owner_email" text,
  "created_by_user_id" uuid,
  "created_by" text,
  "intake_submission_id" uuid,
  "intake_completed_at" timestamp with time zone,
  "country_code" text DEFAULT '+41',
  "is_demo" boolean DEFAULT false,
  "country" text,
  "whatsapp_opt_in" boolean DEFAULT true,
  "marketing_opt_out" boolean DEFAULT false,
  "emergency_contact_name" text,
  "emergency_contact_phone" text,
  "emergency_contact_relation" text
);

CREATE TABLE IF NOT EXISTS public."patients_master_stage" (
  "first_name" text,
  "last_name" text,
  "birth_date_text" text
);

CREATE TABLE IF NOT EXISTS public."providers" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "specialty" text,
  "email" text,
  "phone" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "is_demo" boolean DEFAULT false,
  "gln" text,
  "zsr" text,
  "salutation" text,
  "title" text,
  "street" text,
  "street_no" text,
  "zip_code" text,
  "city" text,
  "canton" text,
  "vatuid" text,
  "iban" text,
  "role" text DEFAULT 'billing_entity',
  "qual_dignities" text[],
  "is_active" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."public_chat_messages" (
  "id" uuid DEFAULT gen_random_uuid(),
  "session_id" uuid,
  "role" text,
  "content" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."public_chat_sessions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "visitor_id" text,
  "visitor_name" text,
  "visitor_email" text,
  "visitor_phone" text,
  "status" text DEFAULT 'active',
  "conversation_type" text DEFAULT 'general',
  "source_url" text,
  "referrer" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_term" text,
  "utm_content" text,
  "interested_service" text,
  "interested_location" text,
  "patient_id" uuid,
  "patient_match_type" text,
  "extracted_data" jsonb,
  "conversation_summary" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "closed_at" timestamp with time zone,
  "message_count" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."retell_call_logs" (
  "id" uuid DEFAULT gen_random_uuid(),
  "retell_call_id" text,
  "patient_id" uuid,
  "deal_id" uuid,
  "scheduled_call_id" uuid,
  "event_type" text,
  "call_status" text,
  "duration_seconds" integer,
  "transcript" text,
  "call_summary" text,
  "recording_url" text,
  "raw_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."retell_request_logs" (
  "id" uuid DEFAULT gen_random_uuid(),
  "call_id" text,
  "event_type" text,
  "function_name" text,
  "request_body" jsonb,
  "args" jsonb,
  "metadata" jsonb,
  "dynamic_variables" jsonb,
  "call_data" jsonb,
  "response_body" jsonb,
  "response_status" integer,
  "processing_time_ms" integer,
  "error_message" text,
  "patient_id" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."retell_scheduled_calls" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "deal_id" uuid,
  "scheduled_for" timestamp with time zone,
  "status" text DEFAULT 'pending',
  "user_name" text,
  "service_name" text,
  "to_number" text,
  "retell_call_id" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "dispatched_at" timestamp with time zone,
  "prompt" text,
  "task_id" uuid,
  "agent_id" text,
  "scheduled_by_email" text,
  "scheduled_by_name" text
);

CREATE TABLE IF NOT EXISTS public."scheduled_emails" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "appointment_id" uuid,
  "recipient_type" text,
  "recipient_email" text,
  "subject" text,
  "body" text,
  "scheduled_for" timestamp with time zone,
  "status" text DEFAULT 'pending',
  "sent_at" timestamp with time zone,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."service_categories" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "description" text,
  "sort_order" integer DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."service_group_services" (
  "id" uuid DEFAULT gen_random_uuid(),
  "group_id" uuid,
  "service_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "discount_percent" numeric,
  "quantity" integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public."service_groups" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "discount_percent" numeric
);

CREATE TABLE IF NOT EXISTS public."services" (
  "id" uuid DEFAULT gen_random_uuid(),
  "category_id" uuid,
  "name" text,
  "description" text,
  "is_active" boolean DEFAULT true,
  "base_price" numeric,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "code" text
);

CREATE TABLE IF NOT EXISTS public."sms_logs" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "to_number" text,
  "from_number" text,
  "message" text,
  "message_type" text DEFAULT 'general',
  "source" text DEFAULT 'manual',
  "twilio_sid" text,
  "status" text DEFAULT 'sent',
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid
);

CREATE TABLE IF NOT EXISTS public."swiss_insurer_laws" (
  "id" uuid DEFAULT gen_random_uuid(),
  "insurer_id" uuid,
  "law_type" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."swiss_insurers" (
  "id" uuid DEFAULT gen_random_uuid(),
  "gln" text,
  "bag_number" text,
  "name" text,
  "name_fr" text,
  "name_de" text,
  "address_street" text,
  "address_postal_code" text,
  "address_city" text,
  "address_canton" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "receiver_gln" text,
  "tp_allowed" boolean DEFAULT true,
  "contact_email" text
);

CREATE TABLE IF NOT EXISTS public."tardoc_group_items" (
  "id" uuid DEFAULT gen_random_uuid(),
  "group_id" uuid,
  "tardoc_code" text,
  "description" text,
  "quantity" double precision DEFAULT 1,
  "ref_code" text,
  "side_type" integer DEFAULT 0,
  "tp_mt" double precision DEFAULT 0,
  "tp_tt" double precision DEFAULT 0,
  "internal_factor_mt" double precision DEFAULT 1,
  "internal_factor_tt" double precision DEFAULT 1,
  "external_factor_mt" double precision DEFAULT 1,
  "external_factor_tt" double precision DEFAULT 1,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."tardoc_groups" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "description" text,
  "canton" text DEFAULT 'GE',
  "law_type" text DEFAULT 'KVG',
  "created_by_user_id" uuid,
  "created_by_name" text,
  "is_active" boolean DEFAULT true,
  "last_validated_at" timestamp with time zone,
  "validation_status" text DEFAULT 'pending',
  "validation_message" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "tax_point_value" numeric
);

CREATE TABLE IF NOT EXISTS public."task_comment_mentions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "task_comment_id" uuid,
  "task_id" uuid,
  "mentioned_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "read_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."task_comments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "task_id" uuid,
  "author_user_id" uuid,
  "author_name" text,
  "body" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."tasks" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "name" text,
  "content" text,
  "status" public.task_status DEFAULT 'not_started'::public.task_status,
  "priority" public.task_priority DEFAULT 'medium'::public.task_priority,
  "type" public.task_type DEFAULT 'todo'::public.task_type,
  "activity_date" timestamp with time zone,
  "created_by_user_id" uuid,
  "created_by_name" text,
  "assigned_user_id" uuid,
  "assigned_user_name" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "assigned_read_at" timestamp with time zone,
  "is_demo" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."temp_patient_treatment_2" (
  "patient_id" text,
  "treatment_id" text,
  "mandator_id" text,
  "treatment_date" text,
  "attached_treatment_title_id" text,
  "treatment_title_id" text,
  "treatment_title_name" text,
  "content" text,
  "updatedbyusername" text,
  "updateddatetime" text,
  "content_text" text,
  "mandator_short_name" text,
  "title" text
);

CREATE TABLE IF NOT EXISTS public."user_availability" (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "day_of_week" integer,
  "start_time" time without time zone DEFAULT '08:00:00',
  "end_time" time without time zone DEFAULT '19:00:00',
  "is_available" boolean DEFAULT true,
  "location" text DEFAULT 'Geneva',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."users" (
  "id" uuid,
  "role" text DEFAULT 'staff',
  "created_at" timestamp with time zone DEFAULT now(),
  "full_name" text,
  "email" text,
  "designation" text,
  "is_demo" boolean DEFAULT false,
  "gln" text,
  "zsr" text,
  "iban" text,
  "bank_name" text,
  "bank_address" text,
  "bic" text,
  "canton" text,
  "billing_language" text DEFAULT 'de',
  "tariff_specialist" boolean DEFAULT false,
  "vat_number" text,
  "billing_email" text,
  "billing_phone" text,
  "provider_id" uuid
);

CREATE TABLE IF NOT EXISTS public."webhook_queue" (
  "id" uuid DEFAULT gen_random_uuid(),
  "source" text,
  "payload" jsonb,
  "status" public.webhook_status DEFAULT 'pending'::public.webhook_status,
  "attempts" integer DEFAULT 0,
  "max_attempts" integer DEFAULT 3,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "processed_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."whatsapp_conversations" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "phone_number" text,
  "last_message_at" timestamp with time zone,
  "last_message_preview" text,
  "unread_count" integer DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "last_inbound_at" timestamp with time zone,
  "window_expires_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."whatsapp_messages" (
  "id" uuid DEFAULT gen_random_uuid(),
  "patient_id" uuid,
  "to_number" text,
  "from_number" text,
  "body" text,
  "status" public.whatsapp_status DEFAULT 'queued'::public.whatsapp_status,
  "direction" public.whatsapp_direction DEFAULT 'outbound'::public.whatsapp_direction,
  "provider_message_sid" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "is_demo" boolean DEFAULT false,
  "message_sid" text,
  "conversation_id" text,
  "template_id" text,
  "media_url" text,
  "error_message" text,
  "delivered_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "metadata" jsonb,
  "scheduled_at" timestamp with time zone,
  "media_content_type" text,
  "original_message_sid" text,
  "template_sid" text,
  "staff_user_id" uuid,
  "read_by" uuid
);

CREATE TABLE IF NOT EXISTS public."whatsapp_notifications" (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "message_id" uuid,
  "patient_id" uuid,
  "title" text,
  "body" text,
  "read" boolean DEFAULT false,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."whatsapp_queue" (
  "id" uuid DEFAULT gen_random_uuid(),
  "sender_user_id" uuid,
  "to_phone" text,
  "message_body" text,
  "patient_id" uuid,
  "deal_id" uuid,
  "workflow_id" uuid,
  "enrollment_id" uuid,
  "status" text DEFAULT 'pending',
  "error_message" text,
  "retry_count" integer DEFAULT 0,
  "max_retries" integer DEFAULT 3,
  "scheduled_at" timestamp with time zone DEFAULT now(),
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."whatsapp_templates" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "category" text DEFAULT 'MARKETING',
  "language" text DEFAULT 'en',
  "body" text,
  "variables" jsonb,
  "meta_template_id" text,
  "twilio_content_sid" text,
  "status" text DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."workflow_actions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "workflow_id" uuid,
  "action_type" public.workflow_action_type,
  "config" jsonb,
  "sort_order" integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public."workflow_enrollment_steps" (
  "id" uuid DEFAULT gen_random_uuid(),
  "enrollment_id" uuid,
  "step_type" text,
  "step_action" text,
  "step_config" jsonb,
  "status" text DEFAULT 'pending',
  "executed_at" timestamp with time zone,
  "result" jsonb,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."workflow_enrollments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "workflow_id" uuid,
  "patient_id" uuid,
  "deal_id" uuid,
  "enrolled_at" timestamp with time zone DEFAULT now(),
  "status" text DEFAULT 'active',
  "trigger_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."workflows" (
  "id" uuid DEFAULT gen_random_uuid(),
  "name" text,
  "trigger_type" public.workflow_trigger_type,
  "active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "config" jsonb,
  "is_demo" boolean DEFAULT false
);



-- Primary keys — must precede the foreign keys that reference them.

DO $$
BEGIN
  ALTER TABLE public."appointment_categories" ADD CONSTRAINT "appointment_categories_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."appointment_history" ADD CONSTRAINT "appointment_history_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."appx_sessions" ADD CONSTRAINT "appx_sessions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."article_distributions" ADD CONSTRAINT "article_distributions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."bank_payment_import_items" ADD CONSTRAINT "bank_payment_import_items_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."bank_payment_imports" ADD CONSTRAINT "bank_payment_imports_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."booking_blocked_dates" ADD CONSTRAINT "booking_blocked_dates_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."booking_doctor_days_off" ADD CONSTRAINT "booking_doctor_days_off_pkey" PRIMARY KEY ("slug");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."call_logs" ADD CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."chat_conversations" ADD CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."chat_folders" ADD CONSTRAINT "chat_folders_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."chat_messages" ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."clinic_onboarding_submissions" ADD CONSTRAINT "clinic_onboarding_submissions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."clinic_onboarding_tokens" ADD CONSTRAINT "clinic_onboarding_tokens_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."consultations" ADD CONSTRAINT "consultations_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."crisalix_reconstructions" ADD CONSTRAINT "crisalix_reconstructions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deal_notifications" ADD CONSTRAINT "deal_notifications_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deal_stages" ADD CONSTRAINT "deal_stages_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deals" ADD CONSTRAINT "deals_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."distribution_backlinks" ADD CONSTRAINT "distribution_backlinks_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."doctor_scheduling_settings" ADD CONSTRAINT "doctor_scheduling_settings_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."document_templates" ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."documents" ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."dropped_call_round_robin" ADD CONSTRAINT "dropped_call_round_robin_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."dropped_calls" ADD CONSTRAINT "dropped_calls_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."email_attachments" ADD CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."email_reply_notifications" ADD CONSTRAINT "email_reply_notifications_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."email_templates" ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."emails" ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."embed_form_leads" ADD CONSTRAINT "embed_form_leads_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."external_labs" ADD CONSTRAINT "external_labs_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoice_installments" ADD CONSTRAINT "invoice_installments_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoice_line_items" ADD CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoice_payments" ADD CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."knowledge_attachments" ADD CONSTRAINT "knowledge_attachments_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."knowledge_messages" ADD CONSTRAINT "knowledge_messages_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."knowledge_topics" ADD CONSTRAINT "knowledge_topics_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."lead_imports" ADD CONSTRAINT "lead_imports_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."legacy_patient_doc_folders" ADD CONSTRAINT "legacy_patient_doc_folders_pkey" PRIMARY KEY ("patient_id", "folder_name");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."marketing_lists" ADD CONSTRAINT "marketing_lists_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medication_template_items" ADD CONSTRAINT "medication_template_items_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medication_templates" ADD CONSTRAINT "medication_templates_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_config" ADD CONSTRAINT "medidata_config_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_notifications_log" ADD CONSTRAINT "medidata_notifications_log_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_responses" ADD CONSTRAINT "medidata_responses_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_submission_history" ADD CONSTRAINT "medidata_submission_history_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_submissions" ADD CONSTRAINT "medidata_submissions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_consultation_data" ADD CONSTRAINT "patient_consultation_data_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_document_versions" ADD CONSTRAINT "patient_document_versions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_documents" ADD CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_edit_locks" ADD CONSTRAINT "patient_edit_locks_pkey" PRIMARY KEY ("patient_id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_form_submissions" ADD CONSTRAINT "patient_form_submissions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_health_background" ADD CONSTRAINT "patient_health_background_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_insurances" ADD CONSTRAINT "patient_insurances_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_intake_photos" ADD CONSTRAINT "patient_intake_photos_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_intake_preferences" ADD CONSTRAINT "patient_intake_preferences_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_intake_submissions" ADD CONSTRAINT "patient_intake_submissions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_measurements" ADD CONSTRAINT "patient_measurements_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_merge_logs" ADD CONSTRAINT "patient_merge_logs_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_note_mentions" ADD CONSTRAINT "patient_note_mentions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_notes" ADD CONSTRAINT "patient_notes_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_prescriptions" ADD CONSTRAINT "patient_prescriptions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_simulations" ADD CONSTRAINT "patient_simulations_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_treatment_areas" ADD CONSTRAINT "patient_treatment_areas_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_treatment_preferences" ADD CONSTRAINT "patient_treatment_preferences_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patients" ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."providers" ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."public_chat_messages" ADD CONSTRAINT "public_chat_messages_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."public_chat_sessions" ADD CONSTRAINT "public_chat_sessions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_call_logs" ADD CONSTRAINT "retell_call_logs_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_request_logs" ADD CONSTRAINT "retell_request_logs_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_scheduled_calls" ADD CONSTRAINT "retell_scheduled_calls_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."scheduled_emails" ADD CONSTRAINT "scheduled_emails_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."service_categories" ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."service_group_services" ADD CONSTRAINT "service_group_services_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."service_groups" ADD CONSTRAINT "service_groups_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."services" ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."sms_logs" ADD CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."swiss_insurer_laws" ADD CONSTRAINT "swiss_insurer_laws_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."swiss_insurers" ADD CONSTRAINT "swiss_insurers_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."tardoc_group_items" ADD CONSTRAINT "tardoc_group_items_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."tardoc_groups" ADD CONSTRAINT "tardoc_groups_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."task_comment_mentions" ADD CONSTRAINT "task_comment_mentions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."task_comments" ADD CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."user_availability" ADD CONSTRAINT "user_availability_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."webhook_queue" ADD CONSTRAINT "webhook_queue_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_notifications" ADD CONSTRAINT "whatsapp_notifications_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."workflow_actions" ADD CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."workflow_enrollment_steps" ADD CONSTRAINT "workflow_enrollment_steps_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."workflows" ADD CONSTRAINT "workflows_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;



-- Foreign keys. Each is tolerant: a missing one relaxes integrity but does

-- not stop a screen rendering, and must not abort the rest of the script.

DO $$
BEGIN
  ALTER TABLE public."appointment_history" ADD CONSTRAINT "appointment_history_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES public."appointments"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES public."providers"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."appointments" ADD CONSTRAINT "appointments_doctor_user_id_fkey" FOREIGN KEY ("doctor_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."appx_sessions" ADD CONSTRAINT "appx_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."appx_sessions" ADD CONSTRAINT "appx_sessions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."bank_payment_import_items" ADD CONSTRAINT "bank_payment_import_items_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES public."bank_payment_imports"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."bank_payment_import_items" ADD CONSTRAINT "bank_payment_import_items_matched_invoice_id_fkey" FOREIGN KEY ("matched_invoice_id") REFERENCES public."invoices"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."bank_payment_import_items" ADD CONSTRAINT "bank_payment_import_items_matched_installment_id_fkey" FOREIGN KEY ("matched_installment_id") REFERENCES public."invoice_installments"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."booking_blocked_dates" ADD CONSTRAINT "booking_blocked_dates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."call_logs" ADD CONSTRAINT "call_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."call_logs" ADD CONSTRAINT "call_logs_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."call_logs" ADD CONSTRAINT "call_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES public."tasks"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."call_logs" ADD CONSTRAINT "call_logs_scheduled_call_id_fkey" FOREIGN KEY ("scheduled_call_id") REFERENCES public."retell_scheduled_calls"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."chat_conversations" ADD CONSTRAINT "chat_conversations_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES public."chat_folders"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."chat_conversations" ADD CONSTRAINT "chat_conversations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."chat_conversations" ADD CONSTRAINT "chat_conversations_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."chat_folders" ADD CONSTRAINT "chat_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES public."chat_conversations"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."clinic_onboarding_submissions" ADD CONSTRAINT "clinic_onboarding_submissions_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES public."clinic_onboarding_tokens"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."consultations" ADD CONSTRAINT "consultations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."consultations" ADD CONSTRAINT "consultations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."crisalix_reconstructions" ADD CONSTRAINT "crisalix_reconstructions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deal_notifications" ADD CONSTRAINT "deal_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deal_notifications" ADD CONSTRAINT "deal_notifications_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deal_notifications" ADD CONSTRAINT "deal_notifications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deal_notifications" ADD CONSTRAINT "deal_notifications_old_stage_id_fkey" FOREIGN KEY ("old_stage_id") REFERENCES public."deal_stages"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deal_notifications" ADD CONSTRAINT "deal_notifications_new_stage_id_fkey" FOREIGN KEY ("new_stage_id") REFERENCES public."deal_stages"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deal_notifications" ADD CONSTRAINT "deal_notifications_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deals" ADD CONSTRAINT "deals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deals" ADD CONSTRAINT "deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES public."deal_stages"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deals" ADD CONSTRAINT "deals_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES public."services"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."distribution_backlinks" ADD CONSTRAINT "distribution_backlinks_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES public."article_distributions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."document_templates" ADD CONSTRAINT "document_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."documents" ADD CONSTRAINT "documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."documents" ADD CONSTRAINT "documents_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."documents" ADD CONSTRAINT "documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."dropped_calls" ADD CONSTRAINT "dropped_calls_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."dropped_calls" ADD CONSTRAINT "dropped_calls_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."dropped_calls" ADD CONSTRAINT "dropped_calls_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES public."tasks"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."email_attachments" ADD CONSTRAINT "email_attachments_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES public."emails"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."email_reply_notifications" ADD CONSTRAINT "email_reply_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."email_reply_notifications" ADD CONSTRAINT "email_reply_notifications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."email_reply_notifications" ADD CONSTRAINT "email_reply_notifications_original_email_id_fkey" FOREIGN KEY ("original_email_id") REFERENCES public."emails"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."email_reply_notifications" ADD CONSTRAINT "email_reply_notifications_reply_email_id_fkey" FOREIGN KEY ("reply_email_id") REFERENCES public."emails"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."emails" ADD CONSTRAINT "emails_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."emails" ADD CONSTRAINT "emails_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."emails" ADD CONSTRAINT "emails_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."embed_form_leads" ADD CONSTRAINT "embed_form_leads_converted_to_patient_id_fkey" FOREIGN KEY ("converted_to_patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoice_installments" ADD CONSTRAINT "invoice_installments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES public."invoices"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES public."invoices"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoice_line_items" ADD CONSTRAINT "invoice_line_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES public."services"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES public."invoices"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoice_payments" ADD CONSTRAINT "invoice_payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES public."consultations"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES public."providers"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_insurer_id_fkey" FOREIGN KEY ("insurer_id") REFERENCES public."swiss_insurers"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_parent_invoice_id_fkey" FOREIGN KEY ("parent_invoice_id") REFERENCES public."invoices"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES public."invoice_installments"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."knowledge_attachments" ADD CONSTRAINT "knowledge_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES public."knowledge_messages"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."knowledge_attachments" ADD CONSTRAINT "knowledge_attachments_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES public."knowledge_topics"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."knowledge_messages" ADD CONSTRAINT "knowledge_messages_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES public."knowledge_topics"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."knowledge_topics" ADD CONSTRAINT "knowledge_topics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."legacy_patient_doc_folders" ADD CONSTRAINT "legacy_patient_doc_folders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES public."marketing_campaigns"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES public."marketing_lists"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medical_records" ADD CONSTRAINT "medical_records_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medication_template_items" ADD CONSTRAINT "medication_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES public."medication_templates"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medication_templates" ADD CONSTRAINT "medication_templates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES public."services"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_notifications_log" ADD CONSTRAINT "medidata_notifications_log_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."medidata_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_responses" ADD CONSTRAINT "medidata_responses_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."medidata_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_submission_history" ADD CONSTRAINT "medidata_submission_history_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."medidata_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_submission_history" ADD CONSTRAINT "medidata_submission_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_submissions" ADD CONSTRAINT "medidata_submissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_submissions" ADD CONSTRAINT "medidata_submissions_insurer_id_fkey" FOREIGN KEY ("insurer_id") REFERENCES public."swiss_insurers"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_submissions" ADD CONSTRAINT "medidata_submissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_submissions" ADD CONSTRAINT "medidata_submissions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES public."invoices"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."medidata_submissions" ADD CONSTRAINT "medidata_submissions_parent_submission_id_fkey" FOREIGN KEY ("parent_submission_id") REFERENCES public."medidata_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_consultation_data" ADD CONSTRAINT "patient_consultation_data_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_consultation_data" ADD CONSTRAINT "patient_consultation_data_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."patient_intake_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_document_versions" ADD CONSTRAINT "patient_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES public."patient_documents"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_document_versions" ADD CONSTRAINT "patient_document_versions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_documents" ADD CONSTRAINT "patient_documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_documents" ADD CONSTRAINT "patient_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES public."document_templates"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_documents" ADD CONSTRAINT "patient_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_documents" ADD CONSTRAINT "patient_documents_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_edit_locks" ADD CONSTRAINT "patient_edit_locks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_edit_locks" ADD CONSTRAINT "patient_edit_locks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_form_submissions" ADD CONSTRAINT "patient_form_submissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_form_submissions" ADD CONSTRAINT "patient_form_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_health_background" ADD CONSTRAINT "patient_health_background_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_health_background" ADD CONSTRAINT "patient_health_background_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."patient_intake_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_insurances" ADD CONSTRAINT "patient_insurances_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_insurances" ADD CONSTRAINT "patient_insurances_insurer_id_fkey" FOREIGN KEY ("insurer_id") REFERENCES public."swiss_insurers"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_intake_photos" ADD CONSTRAINT "patient_intake_photos_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."patient_intake_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_intake_photos" ADD CONSTRAINT "patient_intake_photos_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_intake_preferences" ADD CONSTRAINT "patient_intake_preferences_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."patient_intake_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_intake_preferences" ADD CONSTRAINT "patient_intake_preferences_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_intake_submissions" ADD CONSTRAINT "patient_intake_submissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_measurements" ADD CONSTRAINT "patient_measurements_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."patient_intake_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_measurements" ADD CONSTRAINT "patient_measurements_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_merge_logs" ADD CONSTRAINT "patient_merge_logs_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_note_mentions" ADD CONSTRAINT "patient_note_mentions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES public."patient_notes"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_note_mentions" ADD CONSTRAINT "patient_note_mentions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_note_mentions" ADD CONSTRAINT "patient_note_mentions_mentioned_user_id_fkey" FOREIGN KEY ("mentioned_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_notes" ADD CONSTRAINT "patient_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_notes" ADD CONSTRAINT "patient_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_simulations" ADD CONSTRAINT "patient_simulations_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."patient_intake_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_simulations" ADD CONSTRAINT "patient_simulations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_treatment_areas" ADD CONSTRAINT "patient_treatment_areas_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."patient_intake_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_treatment_areas" ADD CONSTRAINT "patient_treatment_areas_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_treatment_preferences" ADD CONSTRAINT "patient_treatment_preferences_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES public."patient_intake_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patient_treatment_preferences" ADD CONSTRAINT "patient_treatment_preferences_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patients" ADD CONSTRAINT "patients_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."patients" ADD CONSTRAINT "patients_intake_submission_id_fkey" FOREIGN KEY ("intake_submission_id") REFERENCES public."patient_intake_submissions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."public_chat_messages" ADD CONSTRAINT "public_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES public."public_chat_sessions"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."public_chat_sessions" ADD CONSTRAINT "public_chat_sessions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_call_logs" ADD CONSTRAINT "retell_call_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_call_logs" ADD CONSTRAINT "retell_call_logs_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_call_logs" ADD CONSTRAINT "retell_call_logs_scheduled_call_id_fkey" FOREIGN KEY ("scheduled_call_id") REFERENCES public."retell_scheduled_calls"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_request_logs" ADD CONSTRAINT "retell_request_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_scheduled_calls" ADD CONSTRAINT "retell_scheduled_calls_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_scheduled_calls" ADD CONSTRAINT "retell_scheduled_calls_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."retell_scheduled_calls" ADD CONSTRAINT "retell_scheduled_calls_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES public."tasks"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."scheduled_emails" ADD CONSTRAINT "scheduled_emails_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."scheduled_emails" ADD CONSTRAINT "scheduled_emails_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES public."appointments"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."service_group_services" ADD CONSTRAINT "service_group_services_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES public."service_groups"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."service_group_services" ADD CONSTRAINT "service_group_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES public."services"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES public."service_categories"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."sms_logs" ADD CONSTRAINT "sms_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."swiss_insurer_laws" ADD CONSTRAINT "swiss_insurer_laws_insurer_id_fkey" FOREIGN KEY ("insurer_id") REFERENCES public."swiss_insurers"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."tardoc_group_items" ADD CONSTRAINT "tardoc_group_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES public."tardoc_groups"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."task_comment_mentions" ADD CONSTRAINT "task_comment_mentions_task_comment_id_fkey" FOREIGN KEY ("task_comment_id") REFERENCES public."task_comments"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."task_comment_mentions" ADD CONSTRAINT "task_comment_mentions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES public."tasks"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."task_comment_mentions" ADD CONSTRAINT "task_comment_mentions_mentioned_user_id_fkey" FOREIGN KEY ("mentioned_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES public."tasks"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."task_comments" ADD CONSTRAINT "task_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."users" ADD CONSTRAINT "users_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES public."providers"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_read_by_fkey" FOREIGN KEY ("read_by") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_notifications" ADD CONSTRAINT "whatsapp_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_notifications" ADD CONSTRAINT "whatsapp_notifications_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES public."whatsapp_messages"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_notifications" ADD CONSTRAINT "whatsapp_notifications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES public."workflows"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES public."workflow_enrollments"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."workflow_actions" ADD CONSTRAINT "workflow_actions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES public."workflows"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."workflow_enrollment_steps" ADD CONSTRAINT "workflow_enrollment_steps_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES public."workflow_enrollments"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES public."workflows"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES public."patients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

DO $$
BEGIN
  ALTER TABLE public."workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES public."deals"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;

