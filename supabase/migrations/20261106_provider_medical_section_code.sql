-- =====================================================================
-- OAAT Fachbereich (service spécialisé) per provider
-- =====================================================================
-- generalInvoiceRequest_500.xsd defines `section_code` (stringType1_9) as an
-- attribute of serviceType and serviceExType, and Annex H of the tariff
-- convention requires it with every TARDOC position.
--
-- invoice_line_items.section_code already exists and holds real values
-- (0001, 0022, 5002, 7022, …) — but only on about 7% of TARDOC lines; the
-- rest are empty or null. The remaining lines need a default, and the right
-- source is the treating doctor: a TARDOC position's `dignity` lists every
-- specialty permitted to bill it, often several, so it cannot tell us which
-- one this doctor billed under.
--
-- Deliberately left NULL. No value is invented here: until the clinic fills
-- in each doctor's Fachbereich, lines without a stored section_code continue
-- to be sent without the attribute, exactly as today. Writing a guessed code
-- would be worse than omitting an optional attribute.
-- =====================================================================

alter table public.providers
  add column if not exists medical_section_code text;

comment on column public.providers.medical_section_code is
  'OAAT/OTMA Fachbereich ("service spécialisé") of this doctor, e.g. 0001. Emitted as section_code on TARDOC service lines that carry no section_code of their own. NULL = omit the attribute (it is optional in the XSD, minimum length 1, so it must never be written empty).';
