-- Stage 1 of deployment. Reviewed/tested locally before any production use.
-- Requires a fresh database backup. No budgets or Auth accounts are deleted.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare expected_inventory text;
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='access_type') then
    raise exception 'Access migration already present; do not apply twice';
  end if;
  if (select count(*) from public.profiles) <> 6 or
     (select count(*) from public.profiles where access_status='active') <> 5 or
     (select count(*) from public.profiles where role='admin' and access_status='active') <> 1 then
    raise exception 'Account inventory changed since approved audit; review before migrating';
  end if;
  expected_inventory:=case when current_database() ~ '^sb_access_test_[0-9_]+$'
    then 'debe3e85ecaa1ac0437f30c30a420124' else '17217fe4dd1bc985a824295bd0f58581' end;
  if (select md5(string_agg(user_id::text||':'||access_status||':'||role,',' order by user_id)) from public.profiles)
      <> expected_inventory then
    raise exception 'Account identities/statuses/roles differ from the approved inventory; stop and review';
  end if;
end $$;

create schema sb_private;
revoke all on schema sb_private from public, anon, authenticated, service_role;

-- Preserve the exact pre-migration entitlement records for review, not live authorization.
create table sb_private.legacy_profiles as select clock_timestamp() as captured_at, p.* from public.profiles p;
create table sb_private.access_settings (
  singleton boolean primary key default true check (singleton),
  demo_days integer not null default 30 check (demo_days between 1 and 365)
);
insert into sb_private.access_settings default values;
create table sb_private.access_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  user_id uuid,
  event text not null,
  details jsonb not null default '{}'
);
alter table sb_private.legacy_profiles enable row level security;
alter table sb_private.access_settings enable row level security;
alter table sb_private.access_events enable row level security;
revoke all on all tables in schema sb_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema sb_private from public, anon, authenticated, service_role;

alter table public.profiles
  add column access_type text not null default 'DEMO' check (access_type in ('DEMO','COMMERCIAL')),
  add column access_started_at timestamptz,
  add column access_expires_at timestamptz,
  add column access_source text not null default 'normal' check (access_source in ('legacy','normal','admin')),
  add constraint commercial_lifetime_only check (access_type <> 'COMMERCIAL' or access_expires_at is null);

-- Only the five approved active accounts become permanent. Preserve role and IDs.
update public.profiles
set access_type=case when access_status='active' then 'COMMERCIAL' else 'DEMO' end,
    access_started_at=trial_starts_at,
    access_expires_at=case when access_status='active' then null else trial_expires_at end,
    access_source='legacy';
insert into sb_private.access_events(user_id,event,details)
select user_id,'legacy_preserved',jsonb_build_object('type',access_type,'expires_at',access_expires_at,'role',role)
from public.profiles;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Legacy trial fields remain compatible until the new app is published.
  -- The new authoritative DEMO clock starts only in sb_access_status().
  insert into public.profiles(user_id,email,trial_expires_at,access_type,access_source)
  values(new.id,coalesce(new.email,''),clock_timestamp()+interval '30 days','DEMO','normal')
  on conflict(user_id) do nothing;
  insert into public.budget_states(user_id,state) values(new.id,'{}'::jsonb)
  on conflict(user_id) do nothing;
  return new;
end $$;

create function public.sb_has_access() returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id=p.user_id
    where p.user_id=auth.uid() and u.email_confirmed_at is not null
      and p.access_status in ('trial','active')
      and ((p.access_type='COMMERCIAL' and p.access_expires_at is null)
        or (p.access_started_at is not null and p.access_expires_at > statement_timestamp()))
  );
$$;

create function public.sb_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select public.sb_has_access() and exists (
    select 1 from public.profiles where user_id=auth.uid() and role='admin'
  );
$$;

create function sb_private.is_operator() returns boolean
language sql stable security definer set search_path='' as $$
  select public.sb_is_admin() or (
    auth.uid() is null and session_user in ('postgres','supabase_admin')
    and current_setting('role') in ('none','postgres','supabase_admin')
  );
$$;

create function public.sb_access_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; verified boolean; allowed boolean; reason text; stamp timestamptz; days integer;
begin
  if auth.uid() is null then return jsonb_build_object('allowed',false,'reason','sign_in_required'); end if;
  select email_confirmed_at is not null into verified from auth.users where id=auth.uid();
  if not coalesce(verified,false) then return jsonb_build_object('allowed',false,'reason','email_unverified'); end if;
  select * into p from public.profiles where user_id=auth.uid() for update;
  if not found then return jsonb_build_object('allowed',false,'reason','profile_missing'); end if;
  stamp:=clock_timestamp();
  if p.access_type='DEMO' and p.access_source='normal' and p.access_started_at is null and p.access_status='trial' then
    select demo_days into days from sb_private.access_settings where singleton;
    update public.profiles set access_started_at=stamp,access_expires_at=stamp+make_interval(days=>days),
      trial_starts_at=stamp,trial_expires_at=stamp+make_interval(days=>days)
    where user_id=p.user_id returning * into p;
    insert into sb_private.access_events(actor_id,user_id,event,details)
    values(p.user_id,p.user_id,'demo_started',jsonb_build_object('days',days,'expires_at',p.access_expires_at));
  end if;
  allowed:=p.access_status in ('trial','active') and (
    (p.access_type='COMMERCIAL' and p.access_expires_at is null)
    or (p.access_started_at is not null and p.access_expires_at>stamp));
  allowed:=coalesce(allowed,false);
  reason:=case when allowed then 'ok' when p.access_status='blocked' then 'blocked'
    when p.access_status='expired' or p.access_expires_at<=stamp then 'expired' else 'access_unavailable' end;
  return jsonb_build_object('allowed',allowed,'reason',reason,'access_type',p.access_type,
    'expires_at',p.access_expires_at,'server_time',stamp,
    'remaining_seconds',case when p.access_expires_at is null then null
      else greatest(0,extract(epoch from p.access_expires_at-stamp)) end);
end $$;

-- Commercial access is granted only after the owner verifies the purchase externally.
create function public.sb_admin_lookup_access(p_email text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare address text; matches integer; account record;
begin
  if not sb_private.is_operator() then raise exception 'Administrator required' using errcode='42501'; end if;
  address:=lower(btrim(p_email));
  if address is null or length(address) not between 3 and 320 then raise exception 'Invalid email' using errcode='22023'; end if;
  select count(*) into matches from auth.users where lower(btrim(email))=address;
  if matches=0 then raise exception 'Account not found' using errcode='P0002'; end if;
  if matches<>1 then raise exception 'Multiple accounts match this email; review required' using errcode='21000'; end if;
  select u.id as account_id,u.email as account_email,u.email_confirmed_at,p.* into account
  from auth.users u left join public.profiles p on p.user_id=u.id where lower(btrim(u.email))=address;
  if account.user_id is null then raise exception 'Account profile missing; review required' using errcode='P0002'; end if;
  return jsonb_build_object('user_id',account.user_id,'email',account.account_email,'profile_email',account.email,
    'email_verified',account.email_confirmed_at is not null,
    'email_matches_profile',lower(btrim(account.email))=address,
    'access_type',account.access_type,'access_status',account.access_status,'role',account.role,
    'access_expires_at',account.access_expires_at,'access_source',account.access_source,
    'budget_row_exists',exists(select 1 from public.budget_states where user_id=account.user_id));
end $$;

create function public.sb_admin_grant_lifetime(p_email text,p_expected_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare reviewed jsonb; p public.profiles; verified boolean; address text; stamp timestamptz;
begin
  -- Lookup checks authorization and rejects missing/ambiguous accounts before any write.
  reviewed:=public.sb_admin_lookup_access(p_email);
  if p_expected_user_id is null or (reviewed->>'user_id')::uuid<>p_expected_user_id then
    raise exception 'Account does not match reviewed user ID' using errcode='22023';
  end if;
  address:=lower(btrim(p_email));
  -- Recheck and lock both identity and profile so an email change cannot target another account.
  perform u.id from auth.users u join public.profiles pr on pr.user_id=u.id
  where u.id=p_expected_user_id and lower(btrim(u.email))=address for update of u,pr;
  if not found then raise exception 'Account changed; review it again' using errcode='22023'; end if;
  select * into strict p from public.profiles where user_id=p_expected_user_id;
  select email_confirmed_at is not null into verified from auth.users where id=p.user_id;
  if not coalesce(verified,false) then raise exception 'Email verification required' using errcode='22023'; end if;
  if lower(btrim(p.email))<>address then raise exception 'Profile email mismatch; review required' using errcode='22023'; end if;
  if p.access_status='blocked' then raise exception 'Blocked account requires a separate review' using errcode='22023'; end if;
  if p.access_type='COMMERCIAL' then
    if p.access_status<>'active' then raise exception 'Commercial account status requires review' using errcode='22023'; end if;
    return public.sb_admin_lookup_access(p_email)||jsonb_build_object('changed',false);
  end if;
  if p.access_type<>'DEMO' then raise exception 'Expected DEMO account' using errcode='22023'; end if;
  stamp:=clock_timestamp();
  update public.profiles set access_type='COMMERCIAL',access_status='active',access_source='admin',
    access_started_at=stamp,access_expires_at=null where user_id=p.user_id;
  insert into sb_private.access_events(actor_id,user_id,event,details)
  values(auth.uid(),p.user_id,'manual_commercial_granted',jsonb_build_object(
    'database_actor',session_user,
    'before',jsonb_build_object('type',p.access_type,'status',p.access_status,'expires_at',p.access_expires_at),
    'after',jsonb_build_object('type','COMMERCIAL','status','active','expires_at',null)));
  return public.sb_admin_lookup_access(p_email)||jsonb_build_object('changed',true);
end $$;

-- Explicit privileges override broad project defaults. Normal users fail the admin check.
revoke all on function sb_private.is_operator() from public,anon,authenticated,service_role;
revoke all on function public.sb_has_access(),public.sb_is_admin(),public.sb_access_status(),
  public.sb_admin_lookup_access(text),public.sb_admin_grant_lifetime(text,uuid)
from public,anon,authenticated,service_role;
grant execute on function public.sb_has_access(),public.sb_is_admin(),public.sb_access_status(),
  public.sb_admin_lookup_access(text),public.sb_admin_grant_lifetime(text,uuid) to authenticated;

revoke all on function public.handle_new_user(),public.set_updated_at() from public,anon,authenticated;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;

-- Do not grant TRUNCATE/REFERENCES/TRIGGER or let anonymous roles access application tables.
revoke all on public.profiles,public.budget_states,public.terms_acceptances from public,anon,authenticated;
grant select on public.profiles to authenticated;
grant select,insert,update on public.budget_states to authenticated;
grant select,insert on public.terms_acceptances to authenticated;
-- Owner administration is available through the checked RPC / SQL Editor, not direct profile updates.
drop policy profiles_admin_update on public.profiles;
commit;
