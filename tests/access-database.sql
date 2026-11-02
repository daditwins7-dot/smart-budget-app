-- LOCAL TEST DATABASE ONLY. Uses fake accounts and real PostgreSQL roles/RLS.
\set ON_ERROR_STOP on
create function public.test_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',message; end if; end$$;
select test_assert((select count(*) from profiles where access_type='COMMERCIAL' and access_expires_at is null)=5,'five legacy accounts permanent');
select test_assert((select role from profiles where email='legacy1@example.test')='admin','admin preserved');
select test_assert((select count(*) from budget_states where state->>'sentinel'='unchanged')=6,'all budgets preserved');
select test_assert((select access_expires_at<now() from profiles where email='legacy6@example.test'),'old trial not reset');
select test_assert(not has_table_privilege('anon','public.budget_states','TRUNCATE'),'anonymous cannot truncate');
select test_assert(not has_table_privilege('authenticated','public.budget_states','TRUNCATE'),'authenticated cannot truncate');
select test_assert(not has_table_privilege('authenticated','public.profiles','UPDATE'),'users cannot change entitlement columns');
select test_assert(not has_schema_privilege('authenticated','sb_private','USAGE'),'link registry not exposed');
select test_assert(not has_function_privilege('anon','public.sb_create_commercial_link(text)','EXECUTE'),'anonymous cannot issue links');
create table test_links(label text primary key, payload jsonb);
revoke all on test_links from public,anon,authenticated;
insert into test_links values('lifetime',sb_create_commercial_link('Local test Lifetime'));
-- Fresh verified and unverified accounts; real trigger creates profiles.
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-0000-0000-000000000007','demo@example.test',now()),
('00000000-0000-0000-0000-000000000008','unverified@example.test',null),
('00000000-0000-0000-0000-000000000009','disabled-link@example.test',now());

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select test_assert(not sb_has_access(),'no budget access before verified initialization');
select test_assert((select count(*) from budget_states)=0,'RLS denies reads before access check');
select test_assert((sb_access_status()->>'allowed')::boolean,'demo starts on first verified access');
select test_assert((sb_access_status()->>'remaining_seconds')::numeric between 2591990 and 2592000,'demo lasts 30 days');
select test_assert((select count(*) from budget_states)=1,'own budget accessible after check');
update budget_states set state='{"sentinel":"demo-budget"}' where user_id=auth.uid();
do $$begin
  begin perform public.sb_create_commercial_link('unauthorized'); raise exception 'FAILED admin check';
  exception when insufficient_privilege then null; end;
  begin update public.profiles set access_type='COMMERCIAL' where user_id=auth.uid(); raise exception 'FAILED profile protection';
  exception when insufficient_privilege then null; end;
  begin truncate public.budget_states; raise exception 'FAILED truncate protection';
  exception when insufficient_privilege then null; end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','',false);
select test_assert((select count(*) from sb_private.access_events where event='demo_started')=1,'repeated checks do not restart demo');
update profiles set access_expires_at=now()-interval '1 second' where email='demo@example.test';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select test_assert(sb_access_status()->>'reason'='expired','expired demo recognized');
select test_assert((select count(*) from budget_states)=0,'expired demo cannot read budget');
do $$begin
  begin insert into budget_states(user_id,state) values(auth.uid(),'{}') on conflict(user_id) do update set state=excluded.state;
    raise exception 'FAILED expired write protection'; exception when insufficient_privilege then null; end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','',false);
select test_assert((select state->>'sentinel' from budget_states where user_id='00000000-0000-0000-0000-000000000007')='demo-budget','expiry preserves data');
-- Store only test tokens in a session GUC for crossing the real role boundary.
select set_config('test.link',(select payload->>'token' from test_links where label='lifetime'),false);
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',false);
select test_assert(sb_activate_commercial(current_setting('test.link'))->>'reason'='email_unverified','unverified cannot activate');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select test_assert((sb_activate_commercial(current_setting('test.link'))->>'activated')::boolean,'expired demo converts in same account');
select test_assert((select state->>'sentinel' from budget_states where user_id=auth.uid())='demo-budget','conversion preserves budget');
select test_assert(sb_activate_commercial(current_setting('test.link'))->>'reason'='already_activated','redemption idempotent');
reset role;
select set_config('request.jwt.claim.sub','',false);
select test_assert((select count(*) from sb_private.commercial_activations)=1,'one grant event per redemption');
select sb_set_commercial_link_enabled((select (payload->>'link_id')::uuid from test_links where label='lifetime'),false);
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
select test_assert(sb_activate_commercial(current_setting('test.link'))->>'reason'='link_disabled','disabled link cannot grant new access');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select test_assert(sb_has_access(),'revoking link preserves previous Lifetime');
select test_assert((sb_activate_commercial(current_setting('test.link'))->>'activated')::boolean,'prior redemption survives link revocation');
reset role;
select set_config('request.jwt.claim.sub','',false);
-- Future single commercial policy: new link gets one year, old accounts remain permanent.
update sb_private.access_settings set commercial_term='1_YEAR';
insert into test_links values('annual',sb_create_commercial_link('Local test annual'));
select set_config('test.link',(select payload->>'token' from test_links where label='annual'),false);
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
select test_assert((sb_activate_commercial(current_setting('test.link'))->>'activated')::boolean,'replacement link grants new account');
select test_assert((sb_access_status()->>'remaining_seconds')::numeric between 31535900 and 31622500,'calendar year grant');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select test_assert(sb_activate_commercial(current_setting('test.link'))->>'reason'='already_commercial','annual link cannot downgrade Lifetime');
reset role;
select set_config('request.jwt.claim.sub','',false);
select test_assert((select access_expires_at is null from profiles where email='demo@example.test'),'Lifetime remains permanent');
do $$begin
  begin perform sb_admin_set_access('00000000-0000-0000-0000-000000000007','COMMERCIAL',now()+interval '1 year');
    raise exception 'FAILED permanent protection'; exception when raise_exception then
    if sqlerrm<>'Existing Lifetime access cannot be reduced' then raise; end if; end;
end$$;
select sb_admin_set_access('00000000-0000-0000-0000-000000000008','COMMERCIAL');
select test_assert((select access_type='COMMERCIAL' and access_expires_at is null from profiles where email='unverified@example.test'),'operator can grant permanent access');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',false);
select test_assert(not sb_has_access(),'manual grant still requires verified email');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select test_assert(sb_is_admin(),'legacy admin recognized');
select test_assert((sb_create_commercial_link('Verified admin test')->>'link_id') is not null,'verified admin can issue link');
reset role;
select set_config('request.jwt.claim.sub','',false);
select 'PASS: database access, expiry, legacy rights, RLS, revocation, conversion, future policy and admin checks' as result;
