-- Only after guided deployment. Read-only lookup by the buyer's Smart Budget email.
-- Replace the placeholder. Reuse this query AFTER granting to verify the result.
select public.sb_admin_lookup_access('REPLACE_WITH_BUYER_EMAIL') as account_access;
