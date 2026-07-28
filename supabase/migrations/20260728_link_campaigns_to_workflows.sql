alter table public.marketing_campaigns
  add column if not exists workflow_id uuid references public.workflows(id) on delete set null;

create index if not exists marketing_campaigns_workflow_created_idx
  on public.marketing_campaigns(workflow_id, created_at desc);

-- Link existing workflow broadcasts created before workflow_id was recorded.
update public.marketing_campaigns campaign
set workflow_id = workflow.id
from public.workflows workflow
where campaign.workflow_id is null
  and campaign.name = workflow.name;
