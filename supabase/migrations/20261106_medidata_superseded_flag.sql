-- =====================================================================
-- MediData duplicate guard, part 1: the `is_superseded` flag
-- =====================================================================
-- Part 2 (20261106_medidata_unique_active_index.sql) enforces "at most one
-- live submission per invoice" with a partial unique index. That index needs
-- a way to retire a row without deleting it:
--
--   * reconcile-submissions.ts retires the redundant rows that already exist
--     (12 invoices, 34 rows at the time of writing) — the index cannot be
--     created while they are live.
--   * a future stale-pending override needs to replace a row rather than
--     collide with it.
--
-- Deleting submission rows is not an option: they carry the MediData
-- transmission reference and the insurer's response, which is the audit trail
-- for money that has or has not been paid.
-- =====================================================================

alter table public.medidata_submissions
  add column if not exists is_superseded boolean not null default false;

comment on column public.medidata_submissions.is_superseded is
  'Retired in favour of another submission for the same invoice. Excluded from the one-active-submission-per-invoice index and from the application duplicate guard. Never set on a row that holds the authoritative MediData reference.';

create index if not exists medidata_submissions_invoice_active_idx
  on public.medidata_submissions (invoice_id)
  where invoice_id is not null
    and coalesce(is_storno, false) = false
    and coalesce(is_superseded, false) = false;
