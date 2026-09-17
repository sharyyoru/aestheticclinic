-- APPROXIMATED VIEW DEFINITIONS
--
-- The production view bodies are not exposed by the schema spec, so these are
-- reconstructed from the exposed column lists. Column names and types match
-- production exactly; the joins and derived expressions are a best-effort
-- reconstruction and may differ from the originals.
--
-- TO REPLACE WITH THE REAL DEFINITIONS, run this on production and paste the
-- results over the bodies below:
--
--   select table_name, view_definition
--   from information_schema.views
--   where table_schema = 'public' and table_name like 'v_%';
--
-- Only the Debiteurs statistics report and the invoice-line reporting depend on
-- these; everything else in the capture set reads base tables directly.

DROP VIEW IF EXISTS public.v_debiteurs;
DROP VIEW IF EXISTS public.v_invoice_lines_enriched;
DROP VIEW IF EXISTS public.v_invoices_enriched;

CREATE VIEW public.v_invoices_enriched AS
SELECT
  i.id                                            AS invoice_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.email_sent_at,
  i.paid_at,
  COALESCE(i.paid_at, i.insurance_paid_date::timestamptz) AS paid_date_effective,
  i.payment_method,
  i.title                                         AS invoice_title,
  i.subtotal                                      AS amount_excl_vat,
  i.vat_amount                                    AS vat_amount_total,
  i.total_amount,
  i.paid_amount,
  COALESCE(i.reminder_fees, 0)                    AS reminder_fees,
  i.status,
  i.billing_type,
  i.health_insurance_law,
  i.parent_invoice_id,
  CASE WHEN i.status = 'CANCELLED' THEN 'cancelled' ELSE NULL END AS cancellation_flag,
  i.provider_id,
  i.provider_name,
  i.provider_zsr,
  i.provider_gln,
  i.doctor_user_id,
  i.doctor_name,
  i.patient_id,
  p.first_name                                    AS patient_first_name,
  p.last_name                                     AS patient_last_name,
  0::numeric                                      AS vat_free_amount,
  0::numeric                                      AS vat_reduced_taxable,
  0::numeric                                      AS vat_reduced_amount,
  0::numeric                                      AS vat_reduced_rate,
  i.subtotal                                      AS vat_full_taxable,
  i.vat_amount                                    AS vat_full_amount,
  CASE WHEN i.subtotal > 0 THEN ROUND(i.vat_amount / i.subtotal * 100, 2) ELSE 0 END AS vat_full_rate,
  i.is_demo,
  i.is_archived
FROM public.invoices i
LEFT JOIN public.patients p ON p.id = i.patient_id;

CREATE VIEW public.v_invoice_lines_enriched AS
SELECT
  l.id                                            AS line_id,
  l.invoice_id,
  l.sort_order,
  l.code,
  l.name                                          AS line_name,
  l.quantity,
  l.unit_price,
  l.discount_percent,
  l.total_price,
  l.vat_rate,
  l.vat_rate_value,
  l.vat_amount,
  l.tariff_code,
  l.tardoc_code,
  l.tardoc_time,
  l.price_al,
  l.price_tl,
  l.tp_al,
  l.tp_tl,
  l.catalog_name,
  l.catalog_nature,
  l.uncovered_benefit,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.treatment_date,
  i.email_sent_at,
  i.paid_at,
  COALESCE(i.paid_at, i.insurance_paid_date::timestamptz) AS paid_date_effective,
  i.paid_amount                                   AS invoice_paid_amount,
  i.total_amount                                  AS invoice_total_amount,
  i.subtotal                                      AS invoice_subtotal,
  i.vat_amount                                    AS invoice_vat_amount,
  i.status                                        AS invoice_status,
  i.reminder_level,
  COALESCE(i.reminder_fees, 0)                    AS reminder_fees,
  i.health_insurance_law,
  i.billing_type,
  i.parent_invoice_id,
  i.provider_id,
  i.provider_name,
  i.provider_gln,
  i.provider_zsr,
  i.doctor_user_id,
  i.doctor_name,
  i.doctor_gln,
  i.doctor_zsr,
  pr.role                                         AS provider_role,
  i.patient_id,
  CASE
    WHEN i.total_amount > 0
      THEN ROUND(i.paid_amount * (l.total_price / i.total_amount), 2)
    ELSE 0
  END                                             AS line_paid_amount,
  i.is_demo,
  i.is_archived
FROM public.invoice_line_items l
JOIN public.invoices i ON i.id = l.invoice_id
LEFT JOIN public.providers pr ON pr.id = i.provider_id;

CREATE VIEW public.v_debiteurs AS
SELECT
  i.id                                            AS invoice_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.total_amount,
  i.paid_amount,
  COALESCE(i.reminder_fees, 0)                    AS reminder_fees,
  GREATEST(i.total_amount + COALESCE(i.reminder_fees, 0) - i.paid_amount, 0) AS open_amount,
  CASE
    WHEN i.status = 'PARTIAL_LOSS'
      THEN GREATEST(i.total_amount - i.paid_amount, 0)
    ELSE 0
  END                                             AS loss_amount,
  i.status,
  i.reminder_level,
  i.billing_type,
  i.health_insurance_law,
  i.provider_id,
  i.provider_name,
  i.provider_zsr,
  i.provider_gln,
  i.doctor_user_id,
  i.doctor_name,
  i.patient_id,
  p.first_name,
  p.last_name,
  p.email                                         AS patient_email,
  CASE
    WHEN i.due_date IS NOT NULL AND i.paid_at IS NULL
      THEN GREATEST((CURRENT_DATE - i.due_date), 0)
    ELSE 0
  END::integer                                    AS days_overdue,
  i.title                                         AS invoice_title,
  i.email_sent_at,
  i.paid_at,
  i.is_demo,
  i.is_archived
FROM public.invoices i
LEFT JOIN public.patients p ON p.id = i.patient_id
WHERE COALESCE(i.is_archived, false) = false
  AND i.status <> 'PAID';
