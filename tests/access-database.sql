-- LOCAL TEST DATABASE ONLY: fake accounts, real PostgreSQL privileges and RLS.
\set ON_ERROR_STOP on
create function public.test_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',message; end if;end$$;
select test_assert((select count(*) from profiles where access_type='COMMERCIAL' and access_expires_at is null)=5,'five legacy accounts remain permanent');
select test_assert((select role from profiles where email='legacy1@example.test')='admin','administrator role preserved');
select test_assert((select count(*) from budget_states where state->>'sentinel'='unchanged')=6,'existing budgets preserved');
select test_assert((select access_expires_at<now() from profiles where email='legacy6@example.test'),'old unconfirmed trial not restarted');
select test_assert(not has_table_privilege('anon','public.budget_states','TRUNCATE'),'anonymous cannot truncate');
select test_assert(not has_table_privilege('authenticated','public.budget_states','TRUNCATE'),'users cannot truncate');
select test_assert(not has_table_privilege('authenticated','public.profiles','UPDATE'),'users cannot change their entitlement');
select test_assert(not has_schema_privilege('authenticated','sb_private','USAGE'),'audit and configuration are private');
select test_assert(not has_function_privilege('anon','public.sb_admin_grant_lifetime(text,uuid)','EXECUTE'),'anonymous cannot grant commercial access');
select test_assert(not exists(select 1 from pg_proc where proname in ('sb_activate_commercial','sb_create_commercial_link','sb_admin_set_access')),'automatic activation and general plan setter do not exist');
select test_assert(to_regclass('sb_private.commercial_links') is null,'no activation link registry');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000007','demo@example.test',now(),'{"access_type":"COMMERCIAL","role":"admin"}');
select test_assert((select access_type='DEMO' and role='trial_user' and access_source='normal' from profiles where email='demo@example.test'),'client-supplied signup metadata cannot grant commercial or admin access');
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-0000-0000-000000000008','unverified@example.test',null),
('00000000-0000-0000-0000-000000000009','blocked@example.test',now()),
('00000000-0000-0000-0000-000000000010','mismatch@example.test',now()),
('00000000-0000-0000-0000-000000000011','active-demo@example.test',now());
update profiles set access_status='blocked' where email='blocked@example.test';
update profiles set email='different@example.test' where email='mismatch@example.test';

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select test_assert(not sb_has_access(),'DEMO waits for first verified check');
select test_assert((select count(*) from budget_states)=0,'budget cannot load before authorization');
select test_assert((sb_access_status()->>'allowed')::boolean,'verified first access starts DEMO');
select test_assert((sb_access_status()->>'remaining_seconds')::numeric between 2591990 and 2592000,'DEMO lasts 30 days');
select test_assert((select count(*) from budget_states)=1,'user can read only own budget');
update budget_states set state='{"sentinel":"demo-budget","transactions":[{"amount":17.25}]}' where user_id=auth.uid();
do $$begin
  begin perform sb_admin_lookup_access('demo@example.test'); raise exception 'FAILED: unauthorized lookup';
  exception when insufficient_privilege then null;end;
  begin perform sb_admin_grant_lifetime('demo@example.test',auth.uid()); raise exception 'FAILED: self upgrade';
  exception when insufficient_privilege then null;end;
  begin update profiles set access_type='COMMERCIAL' where user_id=auth.uid(); raise exception 'FAILED: direct upgrade';
  exception when insufficient_privilege then null;end;
  begin truncate budget_states; raise exception 'FAILED: truncate';
  exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','',false);
select test_assert((select count(*) from sb_private.access_events where event='demo_started')=1,'repeated checks do not restart DEMO');
update profiles set access_expires_at=now()-interval '1 second' where email='demo@example.test';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select test_assert(sb_access_status()->>'reason'='expired','expired DEMO is identified');
select test_assert((select count(*) from budget_states)=0,'expired DEMO cannot read budget');
do $$begin
  begin insert into budget_states(user_id,state) values(auth.uid(),'{}') on conflict(user_id) do update set state=excluded.state;
    raise exception 'FAILED: expired write'; exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','',false);
select test_assert((select state->>'sentinel' from budget_states where user_id='00000000-0000-0000-0000-000000000007')='demo-budget','expiry retains data');
select test_assert(sb_admin_lookup_access('  DEMO@EXAMPLE.TEST  ')->>'access_type'='DEMO','lookup normalizes email and identifies DEMO');
select test_assert((sb_admin_lookup_access('demo@example.test')->>'budget_row_exists')::boolean,'lookup confirms saved budget exists without reading values');
do $$begin
  begin perform sb_admin_lookup_access('missing@example.test'); raise exception 'FAILED: missing account accepted';
  exception when no_data_found then null;end;
  begin perform sb_admin_grant_lifetime('demo@example.test','00000000-0000-0000-0000-000000000008'); raise exception 'FAILED: wrong reviewed ID';
  exception when invalid_parameter_value then null;end;
  begin perform sb_admin_grant_lifetime('unverified@example.test','00000000-0000-0000-0000-000000000008'); raise exception 'FAILED: unverified';
  exception when invalid_parameter_value then null;end;
  begin perform sb_admin_grant_lifetime('blocked@example.test','00000000-0000-0000-0000-000000000009'); raise exception 'FAILED: blocked';
  exception when invalid_parameter_value then null;end;
  begin perform sb_admin_grant_lifetime('mismatch@example.test','00000000-0000-0000-0000-000000000010'); raise exception 'FAILED: profile email mismatch';
  exception when invalid_parameter_value then null;end;
end$$;
select test_assert((select count(*) from sb_private.access_events where event='manual_commercial_granted')=0,'rejected operations create no grants');
select test_assert((sb_admin_grant_lifetime('demo@example.test','00000000-0000-0000-0000-000000000007')->>'changed')::boolean,'operator converts expired DEMO');
select test_assert(sb_admin_lookup_access('demo@example.test')->>'access_type'='COMMERCIAL','conversion result is commercial');
select test_assert((select access_expires_at is null and access_status='active' and access_source='admin' and role='trial_user' from profiles where email='demo@example.test'),'Lifetime, active, manual source and unchanged role');
select test_assert((select state='{"sentinel":"demo-budget","transactions":[{"amount":17.25}]}'::jsonb from budget_states where user_id='00000000-0000-0000-0000-000000000007'),'same budget remains byte-equivalent as JSON');
select test_assert(not (sb_admin_grant_lifetime('demo@example.test','00000000-0000-0000-0000-000000000007')->>'changed')::boolean,'repeat operation is idempotent');
select test_assert((select count(*) from sb_private.access_events where event='manual_commercial_granted')=1,'one audit event per real conversion');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select test_assert(sb_has_access(),'converted account can enter normally');
select test_assert((select state->>'sentinel' from budget_states where user_id=auth.uid())='demo-budget','normal login recovers previous data');
select test_assert(not sb_is_admin(),'commercial license does not grant administration');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select test_assert(sb_is_admin(),'legacy administrator remains recognized');
select test_assert((sb_admin_grant_lifetime('active-demo@example.test','00000000-0000-0000-0000-000000000011')->>'changed')::boolean,'verified admin can grant Lifetime');
reset role;
select set_config('request.jwt.claim.sub','',false);
update sb_private.access_settings set demo_days=10;
select test_assert((select count(*) from profiles where access_type='COMMERCIAL' and access_expires_at is null)=7,'DEMO policy change cannot reduce existing Lifetime rights');
do $$begin
  begin update profiles set access_expires_at=now()+interval '1 year' where email='demo@example.test'; raise exception 'FAILED: commercial expiry accepted';
  exception when check_violation then null;end;
end$$;
insert into auth.users(email,email_confirmed_at) values('duplicate@example.test',now()),('DUPLICATE@example.test',now());
do $$begin
  begin perform sb_admin_lookup_access('duplicate@example.test'); raise exception 'FAILED: ambiguous account accepted';
  exception when cardinality_violation then null;end;
end$$;
select test_assert((select count(*) from auth.users)=(select count(*) from profiles),'no duplicate profile created by activation');
select test_assert((select count(*) from budget_states where state->>'sentinel'='unchanged')=6,'all original budgets still intact');
select 'PASS: server DEMO, manual verified grants, preserved accounts/budgets, RLS and administrative safeguards' as result;
