-- Only after guided deployment AND manual verification of the Etsy purchase.
-- Replace the email and the user_id returned by admin_find_account.sql.
-- The UUID is an internal account identifier, not an activation code for the buyer.
-- Wrong/missing IDs, unverified emails, blocked or ambiguous accounts are rejected.
select public.sb_admin_grant_lifetime(
  'REPLACE_WITH_BUYER_EMAIL',
  '00000000-0000-0000-0000-000000000000'::uuid
) as activation_result;
