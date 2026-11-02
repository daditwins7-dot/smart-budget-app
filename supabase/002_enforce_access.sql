-- Deploy ONLY after the new client is published and tested with the prepared backend.
-- The operator must confirm the current database backup before applying this file.
begin;
set local lock_timeout='5s';
drop policy budget_select_own_or_admin on public.budget_states;
drop policy budget_insert_own on public.budget_states;
drop policy budget_update_own on public.budget_states;
create policy budget_select_own_or_admin on public.budget_states for select to authenticated
using ((user_id=auth.uid() and (select public.sb_has_access())) or (select public.sb_is_admin()));
create policy budget_insert_own on public.budget_states for insert to authenticated
with check(user_id=auth.uid() and (select public.sb_has_access()));
create policy budget_update_own on public.budget_states for update to authenticated
using(user_id=auth.uid() and (select public.sb_has_access()))
with check(user_id=auth.uid() and (select public.sb_has_access()));
drop policy profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select to authenticated
using(user_id=auth.uid() or (select public.sb_is_admin()));
drop policy terms_select_own_or_admin on public.terms_acceptances;
create policy terms_select_own_or_admin on public.terms_acceptances for select to authenticated
using(user_id=auth.uid() or (select public.sb_is_admin()));
drop policy terms_insert_own on public.terms_acceptances;
create policy terms_insert_own on public.terms_acceptances for insert to authenticated
with check(user_id=auth.uid() and (select public.sb_has_access()));
commit;
