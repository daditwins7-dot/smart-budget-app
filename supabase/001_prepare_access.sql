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
  if not exists (select 1 from pg_extension where extname='pgcrypto') then
    raise exception 'Expected pgcrypto extension is missing';
  end if;
end $$;

create schema sb_private;
revoke all on schema sb_private from public, anon, authenticated, service_role;

-- Preserve the exact pre-migration entitlement records for review, not live authorization.
create table sb_private.legacy_profiles as select clock_timestamp() as captured_at, p.* from public.profiles p;
create table sb_private.access_settings (
  singleton boolean primary key default true check (singleton),
  demo_days integer not null default 30 check (demo_days between 1 and 365),
  commercial_term text not null default 'LIFETIME' check (commercial_term in ('LIFETIME','1_YEAR'))
);
insert into sb_private.access_settings default values;
create table sb_private.commercial_links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  token_hash bytea not null unique,
  enabled boolean not null default true,
  commercial_term text not null check (commercial_term in ('LIFETIME','1_YEAR')),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id),
  disabled_at timestamptz
);
create table sb_private.commercial_activations (
  user_id uuid not null references auth.users(id),
  link_id uuid not null references sb_private.commercial_links(id),
  activated_at timestamptz not null default clock_timestamp(),
  commercial_term text not null,
  granted_expires_at timestamptz,
  primary key (user_id, link_id)
);
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
alter table sb_private.commercial_links enable row level security;
alter table sb_private.commercial_activations enable row level security;
alter table sb_private.access_events enable row level security;
revoke all on all tables in schema sb_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema sb_private from public, anon, authenticated, service_role;

alter table public.profiles
  add column access_type text not null default 'DEMO' check (access_type in ('DEMO','COMMERCIAL')),
  add column access_started_at timestamptz,
  add column access_expires_at timestamptz,
  add column access_source text not null default 'normal' check (access_source in ('legacy','normal','commercial_link','admin'));

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

create function public.sb_create_commercial_link(p_label text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare secret text; term text; link_id uuid;
begin
  if not sb_private.is_operator() then raise exception 'Administrator required' using errcode='42501'; end if;
  if length(trim(p_label)) not between 1 and 120 then raise exception 'Invalid label'; end if;
  select commercial_term into term from sb_private.access_settings where singleton;
  secret:=encode(extensions.gen_random_bytes(32),'hex');
  insert into sb_private.commercial_links(label,token_hash,commercial_term,created_by)
  values(trim(p_label),extensions.digest(secret,'sha256'),term,auth.uid()) returning id into link_id;
  insert into sb_private.access_events(actor_id,event,details)
  values(auth.uid(),'link_created',jsonb_build_object('link_id',link_id,'term',term));
  -- Returned once to the operator. Never stored or logged as plaintext.
  return jsonb_build_object('link_id',link_id,'token',secret,'commercial_term',term);
end $$;

create function public.sb_set_commercial_link_enabled(p_link_id uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not sb_private.is_operator() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_enabled is null then raise exception 'Enabled must be true or false'; end if;
  update sb_private.commercial_links set enabled=p_enabled,
    disabled_at=case when p_enabled then null else clock_timestamp() end where id=p_link_id;
  if not found then raise exception 'Link not found'; end if;
  insert into sb_private.access_events(actor_id,event,details)
  values(auth.uid(),'link_state_changed',jsonb_build_object('link_id',p_link_id,'enabled',p_enabled));
end $$;

create function public.sb_activate_commercial(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; link sb_private.commercial_links; stamp timestamptz; expiry timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('activated',false,'reason','sign_in_required'); end if;
  if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    return jsonb_build_object('activated',false,'reason','email_unverified');
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('activated',false,'reason','invalid_link');
  end if;
  select * into p from public.profiles where user_id=auth.uid() for update;
  if not found then return jsonb_build_object('activated',false,'reason','profile_missing'); end if;
  if p.access_status='blocked' then return jsonb_build_object('activated',false,'reason','blocked'); end if;
  -- Serializes redemption with disable/enable so a revoked link cannot grant a new license.
  select * into link from sb_private.commercial_links
  where token_hash=extensions.digest(p_token,'sha256') for update;
  if not found then return jsonb_build_object('activated',false,'reason','invalid_link'); end if;
  if exists(select 1 from sb_private.commercial_activations where user_id=p.user_id and link_id=link.id) then
    return jsonb_build_object('activated',true,'reason','already_activated','access',public.sb_access_status());
  end if;
  if not link.enabled then return jsonb_build_object('activated',false,'reason','link_disabled'); end if;
  -- A shared link must not shorten Lifetime or repeatedly renew an annual account.
  if p.access_type='COMMERCIAL' then
    return jsonb_build_object('activated',true,'reason','already_commercial','access',public.sb_access_status());
  end if;
  stamp:=clock_timestamp();
  expiry:=case when link.commercial_term='LIFETIME' then null else stamp+interval '1 year' end;
  update public.profiles set access_type='COMMERCIAL',access_status='active',access_source='commercial_link',
    access_started_at=stamp,access_expires_at=expiry where user_id=p.user_id;
  insert into sb_private.commercial_activations(user_id,link_id,commercial_term,granted_expires_at)
  values(p.user_id,link.id,link.commercial_term,expiry);
  insert into sb_private.access_events(actor_id,user_id,event,details)
  values(p.user_id,p.user_id,'commercial_activated',jsonb_build_object('link_id',link.id,'term',link.commercial_term,'expires_at',expiry));
  return jsonb_build_object('activated',true,'reason','activated','access',public.sb_access_status());
end $$;

create function public.sb_admin_set_access(p_user_id uuid,p_type text,p_expires_at timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
  if not sb_private.is_operator() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_type not in ('DEMO','COMMERCIAL') or p_type is null then raise exception 'Invalid access type'; end if;
  if p_type='DEMO' and p_expires_at is null then raise exception 'DEMO requires an expiration date'; end if;
  select * into strict p from public.profiles where user_id=p_user_id for update;
  if p.access_type='COMMERCIAL' and p.access_expires_at is null and (p_type<>'COMMERCIAL' or p_expires_at is not null) then
    raise exception 'Existing Lifetime access cannot be reduced';
  end if;
  update public.profiles set access_type=p_type,access_status=case when p_type='DEMO' then 'trial' else 'active' end,
    access_source='admin',access_started_at=coalesce(access_started_at,clock_timestamp()),access_expires_at=p_expires_at
  where user_id=p_user_id;
  insert into sb_private.access_events(actor_id,user_id,event,details)
  values(auth.uid(),p_user_id,'admin_access_changed',jsonb_build_object('before',to_jsonb(p), 'type',p_type,'expires_at',p_expires_at));
end $$;

-- Explicit grants: do not inherit the broad project defaults.
revoke all on function sb_private.is_operator() from public,anon,authenticated,service_role;
revoke all on function public.sb_has_access(),public.sb_is_admin(),public.sb_access_status(),
  public.sb_create_commercial_link(text),public.sb_set_commercial_link_enabled(uuid,boolean),
  public.sb_activate_commercial(text),public.sb_admin_set_access(uuid,text,timestamptz)
from public,anon,authenticated,service_role;
grant execute on function public.sb_has_access(),public.sb_is_admin(),public.sb_access_status(),
  public.sb_create_commercial_link(text),public.sb_set_commercial_link_enabled(uuid,boolean),
  public.sb_activate_commercial(text),public.sb_admin_set_access(uuid,text,timestamptz) to authenticated;
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
