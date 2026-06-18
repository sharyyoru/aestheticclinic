-- Per-doctor recurring days off for the online booking system.
--
-- Each row is one doctor (keyed by the booking page "slug", e.g. "xavier-tenorio").
-- days_off holds the weekday numbers the doctor is OFF, using JS getDay()
-- convention: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
--
-- Managed from Settings -> "Doctor Days Off" and consumed by the public
-- booking pages + /api/public/book-appointment to hide/refuse those weekdays.

create table if not exists public.booking_doctor_days_off (
  slug        text primary key,
  days_off    smallint[] not null default '{}',
  updated_at  timestamptz not null default now()
);

comment on table public.booking_doctor_days_off is
  'Recurring weekday days-off per doctor for online booking. days_off uses 0=Sun..6=Sat.';

-- The settings UI + booking pages read/write through the service-role API route,
-- so RLS can stay enabled with no public policies (matches booking_blocked_dates).
alter table public.booking_doctor_days_off enable row level security;
