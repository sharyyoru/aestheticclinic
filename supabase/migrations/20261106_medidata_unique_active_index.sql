-- =====================================================================
-- MediData duplicate guard, part 2: enforcement
-- =====================================================================
-- The database backstop for the application guard in
-- /api/medidata/send-invoice. The app check gives users a friendly message
-- and offers a Storno; this index is what makes the invariant actually hold
-- when two people click "Send to insurance" at the same moment, or when a
-- bulk script works the backlog outside the API.
--
-- This matters now specifically because ~20 days of insurance invoicing is
-- queued. Releasing a backlog is exactly the situation that produces
-- duplicates, and duplicates are already the top rejection reason here:
-- 1,270 submissions cover far fewer invoices, one of them sent 15 times.
--
-- PREREQUISITE — ORDER IS LOAD-BEARING:
--   npx tsx scripts/medidata/reconcile-submissions.ts --confirm
-- must run BEFORE this migration. 12 invoices currently have more than one
-- active submission and the index cannot be created while they exist. The
-- guard below aborts with an actionable message rather than failing on an
-- opaque constraint violation.
-- =====================================================================

do $$
declare
  offenders int;
  detail text;
begin
  select count(*) into offenders from (
    select invoice_id
      from public.medidata_submissions
     where invoice_id is not null
       and coalesce(is_storno, false) = false
       and coalesce(is_superseded, false) = false
       and status in ('pending','transmitted','delivered','accepted')
     group by invoice_id
    having count(*) > 1
  ) t;

  if offenders > 0 then
    select string_agg(invoice_number, ', ') into detail from (
      select max(invoice_number) as invoice_number
        from public.medidata_submissions
       where invoice_id is not null
         and coalesce(is_storno, false) = false
         and coalesce(is_superseded, false) = false
         and status in ('pending','transmitted','delivered','accepted')
       group by invoice_id
      having count(*) > 1
      limit 20
    ) t;

    raise exception
      'Cannot create the one-active-submission-per-invoice index: % invoice(s) still have multiple active submissions (%). Run: npx tsx scripts/medidata/reconcile-submissions.ts --confirm',
      offenders, coalesce(detail, 'unknown');
  end if;
end $$;

-- A plain (non-CONCURRENT) index is used deliberately: this table holds about
-- 1,300 rows, so the build is effectively instantaneous and the brief lock is
-- harmless, whereas CREATE INDEX CONCURRENTLY cannot run inside the
-- transaction that migrations execute in.
--
-- Predicate rationale:
--   is_storno       - a Storno is a second, legitimate message about the same
--                     invoice and must never collide with the original.
--   is_superseded   - lets reconcile (and any future stale-pending override)
--                     retire a row and insert a replacement without tripping
--                     the constraint.
--   status IN (...) - `draft` never blocks, and `rejected`/`cancelled` are
--                     terminal, so a corrected resend after a data-error
--                     rejection stays possible without a Storno. `delivered`
--                     is included because mapUploadStatusToSubmissionStatus
--                     can produce it and it is unambiguously live.
create unique index if not exists medidata_submissions_one_active_per_invoice
  on public.medidata_submissions (invoice_id)
  where invoice_id is not null
    and coalesce(is_storno, false) = false
    and coalesce(is_superseded, false) = false
    and status in ('pending','transmitted','delivered','accepted');

comment on index public.medidata_submissions_one_active_per_invoice is
  'At most one live submission per invoice. Violations surface as SQLSTATE 23505 and are translated into a friendly 409 ALREADY_SUBMITTED by /api/medidata/send-invoice.';

do $$
begin
  raise notice 'medidata duplicate guard part 2 applied: one active submission per invoice is now enforced';
end $$;
