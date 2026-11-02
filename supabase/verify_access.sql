-- Read-only checks after an operator-guided deployment. No secret tokens returned.
select access_type, access_status, access_source, count(*) as accounts,
       count(*) filter (where access_type='COMMERCIAL' and access_expires_at is null) as lifetime_accounts
from public.profiles group by access_type,access_status,access_source order by access_type,access_status,access_source;

select p.user_id, p.email, p.role, p.access_type, p.access_expires_at,
  exists(select 1 from public.budget_states b where b.user_id=p.user_id) as budget_row_exists
from public.profiles p join sb_private.legacy_profiles l on l.user_id=p.user_id
order by p.email;

select grantee,table_name,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in ('profiles','budget_states','terms_acceptances')
  and grantee in ('PUBLIC','anon','authenticated') order by table_name,grantee,privilege_type;

select tablename,policyname,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('profiles','budget_states','terms_acceptances') order by tablename,policyname;

select id,label,enabled,commercial_term,created_at,disabled_at from sb_private.commercial_links order by created_at;
select a.link_id,l.label,p.email,a.activated_at,a.commercial_term,a.granted_expires_at
from sb_private.commercial_activations a join sb_private.commercial_links l on l.id=a.link_id
join public.profiles p on p.user_id=a.user_id order by a.activated_at;
