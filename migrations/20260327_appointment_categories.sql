-- Migration: Add appointment_categories table for customizable category colors
-- Created: 2026-03-27

-- Create appointment_categories table
create table if not exists appointment_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'bg-slate-300/70',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for faster lookups
create index if not exists appointment_categories_name_idx on appointment_categories(name);
create index if not exists appointment_categories_sort_order_idx on appointment_categories(sort_order);

-- Seed initial categories with default colors (hex format for color picker)
insert into appointment_categories (name, color, sort_order) values
  ('No selection', '#e0f2fe', 0),
  ('Mesotherapy', '#d8b4fe', 1),
  ('Dermomask', '#bef264', 2),
  ('1ère consultation', '#fef08a', 3),
  ('Administration', '#cbd5e1', 4),
  ('Cavitation', '#86efac', 5),
  ('CO2', '#fbcfe8', 6),
  ('Control', '#5eead4', 7),
  ('Emla Cream', '#99f6e4', 8),
  ('Cryotherapy', '#d8b4fe', 9),
  ('Discussion', '#bae6fd', 10),
  ('EMSCULPT', '#5eead4', 11),
  ('Cutera laser hair removal', '#cbd5e1', 12),
  ('Epilation laser Gentel', '#86efac', 13),
  ('Electrolysis hair removal', '#a5b4fc', 14),
  ('HIFU', '#fbcfe8', 15),
  ('Injection (botox; Acide hyaluronic)', '#bae6fd', 16),
  ('Important', '#fca5a5', 17),
  ('IPL', '#e9d5ff', 18),
  ('Meso Anti-age', '#fcd34d', 19),
  ('Meso Anti-cellulite', '#fcd34d', 20),
  ('Meso Anti-tache', '#fcd34d', 21),
  ('Microdermabrasion', '#93c5fd', 22),
  ('MORPHEUS8', '#fbbf24', 23),
  ('Radio frequency', '#d9f99d', 24),
  ('Meeting', '#fbcfe8', 25),
  ('OP Surgery', '#86efac', 26),
  ('Breaks/Change of Location', '#d8b4fe', 27),
  ('PRP', '#fdba74', 28),
  ('Tatoo removal', '#fcd34d', 29),
  ('TCA', '#e9d5ff', 30),
  ('Treatment', '#e9d5ff', 31),
  ('Caviar treatment', '#c7d2fe', 32),
  ('Vacation/Leave', '#d9f99d', 33),
  ('Visia', '#fef08a', 34)
on conflict (name) do nothing;

-- Enable RLS
alter table appointment_categories enable row level security;

-- RLS policies - all authenticated users can read, admins can modify
create policy "Anyone can view appointment categories"
  on appointment_categories for select
  using (true);

create policy "Admins can insert appointment categories"
  on appointment_categories for insert
  with check (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('admin', 'staff')
    )
  );

create policy "Admins can update appointment categories"
  on appointment_categories for update
  using (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('admin', 'staff')
    )
  );

create policy "Admins can delete appointment categories"
  on appointment_categories for delete
  using (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role = 'admin'
    )
  );
