-- EMERGENCY ONLY. Restores the PREVIOUS, WEAKER budget access policies.
-- Never run without an operator review: expired accounts may regain API access.
-- Preserves all budgets, accounts, licenses, activation events and new columns.
-- This is not a full schema rollback and does not restore unsafe TRUNCATE grants.
begin;
set local lock_timeout='5s';
drop policy budget_select_own_or_admin on public.budget_states;
drop policy budget_insert_own on public.budget_states;
drop policy budget_update_own on public.budget_states;
create policy budget_select_own_or_admin on public.budget_states for select to authenticated
using(user_id=auth.uid() or public.is_admin());
create policy budget_insert_own on public.budget_states for insert to authenticated with check(user_id=auth.uid());
create policy budget_update_own on public.budget_states for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
commit;
