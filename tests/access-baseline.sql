-- LOCAL TEST DATABASE ONLY. Never run against Supabase.
do $$begin if current_database() !~ '^sb_access_test_[0-9_]+$' then raise exception 'Local test database required'; end if;end$$;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
do $$begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to public;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}',
  email_confirmed_at timestamptz, created_at timestamptz not null default now());
create table public.profiles(
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null, role text not null default 'trial_user' check(role in ('admin','trial_user','active_user')),
  access_status text not null default 'trial' check(access_status in ('trial','active','expired','blocked')),
  trial_starts_at timestamptz not null default now(),trial_expires_at timestamptz,
  terms_required_version text not null default '2026-06-04-trial-access',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.budget_states(user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}',updated_at timestamptz not null default now());
create table public.terms_acceptances(id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, terms_version text not null,
  accepted_at timestamptz not null default now(), user_email text, acceptance_source text not null default 'smart_budget_app');
create function public.is_admin() returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from public.profiles where user_id=auth.uid() and role='admin' and access_status in ('active','trial'));
$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(user_id,email,trial_expires_at) values(new.id,coalesce(new.email,''),now()+interval '30 days') on conflict do nothing;
  insert into public.budget_states(user_id,state) values(new.id,'{}') on conflict do nothing;
  return new;
end $$;
create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger budget_states_set_updated_at before update on public.budget_states for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;
alter table public.budget_states enable row level security;
alter table public.terms_acceptances enable row level security;
create policy budget_select_own_or_admin on public.budget_states for select to authenticated using(user_id=auth.uid() or is_admin());
create policy budget_insert_own on public.budget_states for insert to authenticated with check(user_id=auth.uid());
create policy budget_update_own on public.budget_states for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy profiles_select_own_or_admin on public.profiles for select to authenticated using(user_id=auth.uid() or is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated using(is_admin()) with check(is_admin());
create policy terms_select_own_or_admin on public.terms_acceptances for select to authenticated using(user_id=auth.uid() or is_admin());
create policy terms_insert_own on public.terms_acceptances for insert to authenticated with check(user_id=auth.uid());
grant all on all tables in schema public to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
insert into auth.users(id,email,email_confirmed_at)
select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
  'legacy'||i||'@example.test',case when i<=5 then now() else null end from generate_series(1,6) i;
update public.profiles set access_status='active',trial_expires_at=now()-interval '90 days' where email<>'legacy6@example.test';
update public.profiles set role='admin' where email='legacy1@example.test';
update public.profiles set trial_expires_at=now()-interval '90 days' where email='legacy6@example.test';
update public.budget_states set state='{"sentinel":"unchanged","regularIncome":1234.56}';
