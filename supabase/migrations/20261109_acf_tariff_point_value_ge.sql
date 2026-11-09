-- =====================================================================
-- Ambulatory flat rate (tariff 005): explicit tax point value for GE
-- =====================================================================
-- 20261106_tariff_point_values.sql seeded tariff_type '007' only (TARDOC,
-- one row per canton). A flat-rate lookup therefore matched nothing and fell
-- through to the caller-supplied constant in
-- /api/tardoc/tax-point-value — CANTON_TAX_POINT_VALUES[canton] ?? 0.96 —
-- which for Geneva happens to be 0.96 as well.
--
-- So the value billed was already 0.96, but by coincidence rather than by
-- decision: it was reported as source "fallback", it would silently become
-- the cantonal TARDOC value in any other canton (0.93 in VD, for instance),
-- and there was no row for anyone to correct. This records it explicitly.
--
-- 0.96 is an INTERIM value, confirmed by the clinic on 2026-11-09. The
-- invoices MediData accepted carry 0.91, 0.94, 0.96 and 1 on tariff 005
-- lines, all in canton GE, so the real figure very likely depends on the
-- insurer agreement. Correcting it later means updating this one row — or
-- adding insurer-specific rows, which resolveTariffPointValue already
-- prefers over a canton-wide one.
--
-- GE only, deliberately: all 1,271 insurance submissions to date are canton
-- GE. No value is invented for cantons the clinic does not bill in.
-- =====================================================================

insert into public.tariff_point_values
  (insurer_gln, insurer_group, canton, law_type, tariff_type, value, valid_from, valid_to, note)
select
  null, null, 'GE', null, '005', 0.96, '2000-01-01'::date, null,
  'Interim value confirmed by the clinic 2026-11-09. Accepted invoices show 0.91, 0.94, 0.96 and 1 for tariff 005 in GE, so this very likely varies by insurer agreement — revisit once the ACF agreement is checked.'
where not exists (
  select 1 from public.tariff_point_values
   where canton = 'GE'
     and tariff_type = '005'
     and coalesce(insurer_gln, '') = ''
     and coalesce(insurer_group, '') = ''
     and coalesce(law_type, '') = ''
     and valid_from = '2000-01-01'::date
);
