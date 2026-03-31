-- Booking blocked dates - dates when the clinic is closed for all doctors
create table if not exists booking_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null unique,
  reason text,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create index if not exists booking_blocked_dates_date_idx on booking_blocked_dates(blocked_date);
