-- Completed campaigns appear as unread email notifications for their creator.
alter table public.marketing_campaigns
  add column if not exists notification_read_at timestamptz;

create index if not exists marketing_campaigns_creator_completed_idx
  on public.marketing_campaigns(created_by, completed_at desc)
  where completed_at is not null;
