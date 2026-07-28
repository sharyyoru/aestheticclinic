alter table public.marketing_campaign_recipients
  add column if not exists processing_started_at timestamptz;

create index if not exists marketing_recipients_pending_idx
  on public.marketing_campaign_recipients(campaign_id, status, processing_started_at);
