-- DAKHLA FIT — Supabase Orders Schema & RLS Policies
-- Run this script once in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/raaompkdkyghhyuxfnen/sql/new

create table if not exists public.orders (
  id text primary key,
  full_name text not null,
  phone text not null,
  city text not null,
  pack_name text not null,
  quantity integer not null default 1 check (quantity >= 1 and quantity <= 10),
  total_price integer not null check (total_price >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'canceled')),
  whatsapp_url text not null default '',
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

alter table public.orders enable row level security;

drop policy if exists "Allow anon insert orders" on public.orders;
create policy "Allow anon insert orders"
  on public.orders
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow anon select orders" on public.orders;
create policy "Allow anon select orders"
  on public.orders
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow anon update orders" on public.orders;
create policy "Allow anon update orders"
  on public.orders
  for update
  to anon, authenticated
  using (true)
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
