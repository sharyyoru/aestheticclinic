-- Allow workflows that are explicitly run by an administrator.
alter type public.workflow_trigger_type add value if not exists 'manual';
