-- Fix admin schema and prevent retry issues
-- This migration adds missing tables and columns needed by the admin interface

-- properties.is_active (needed by front)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='properties' and column_name='is_active'
  ) then
    alter table public.properties add column is_active boolean not null default true;
    comment on column public.properties.is_active is 'Soft-enable property in admin lists';
  end if;
end$$;

-- token_control_settings table (minimal shape)
create table if not exists public.token_control_settings(
  id uuid primary key default gen_random_uuid(),
  control_type text not null default 'allow',  -- e.g., allow/blocked/maintenance
  is_enabled boolean not null default true,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS (relaxed read)
alter table public.token_control_settings enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='token_control_settings' and policyname='read_all_authenticated'
  ) then
    create policy read_all_authenticated on public.token_control_settings
      for select using (true);
  end if;
end$$;

-- admin_users table (if not already there)
create table if not exists public.admin_users(
  user_id uuid primary key,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='admin_users' and policyname='read_admin_users'
  ) then
    create policy read_admin_users on public.admin_users for select using (true);
  end if;
end$$;

-- RPC get_users_for_admin (stable, security definer)
-- Drop existing function first to avoid return type conflicts
drop function if exists public.get_users_for_admin();

create or replace function public.get_users_for_admin()
returns setof public.admin_users
language sql
security definer
stable
as $$ select * from public.admin_users $$;

grant execute on function public.get_users_for_admin() to anon, authenticated;

-- Add indexes for better performance
create index if not exists idx_properties_is_active on public.properties(is_active);
create index if not exists idx_token_control_settings_created_at on public.token_control_settings(created_at);
create index if not exists idx_admin_users_is_active on public.admin_users(is_active);

-- Add comments
comment on table public.token_control_settings is 'Controls token generation and usage policies';
comment on table public.admin_users is 'Admin user roles and permissions';
comment on function public.get_users_for_admin() is 'Returns all admin users for admin interface';
