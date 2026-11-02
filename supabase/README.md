# DEMO / COMMERCIAL rollout

Status: prepared locally. **Do not run deployment SQL until the operator-guided stage.**

## Model

- `profiles.access_type`: DEMO or COMMERCIAL, separate from the existing admin role.
- `access_started_at`, `access_expires_at`, `access_source` are authoritative on the server. NULL expiry means Lifetime only for COMMERCIAL.
- Normal confirmed first access initializes a 30-day DEMO once, under a profile row lock. The existing expired/unconfirmed account keeps its old dates.
- Five approved active accounts are grandfathered as permanent, preserving user IDs and administrator role. Migration aborts on inventory drift, before changing schema/data.
- Private registry stores SHA-256 digests of 256-bit commercial keys. Shared keys are accepted intentionally; a key proves possession, not an Etsy purchase.
- Commercial activation is allowed only for a verified signed-in account, including an expired DEMO. It never creates another account or touches budget values.
- A grant is independent of the link's enabled flag after redemption. Repeated redemption is idempotent. Existing commercial access is never shortened or renewed by reusing a shared link.
- Lifetime cannot be shortened through the administrative grant RPC. Disabling the account is a separate trusted-administration decision.
- Public RPCs have explicit EXECUTE grants. Private tables/digests have no API-role privileges. Administrative RPCs verify a server-owned admin profile, or an actual database operator session.
- The secret lives in the buyer's URL fragment and optional pending browser storage, never in application source. It is removed from the address bar immediately. Do not log, publish or commit a real commercial URL.

## Required before production

1. Obtain the actual Etsy listing URL. Set `src/config/access.js` to that HTTPS Etsy URL. Until then the purchase button stays hidden; do not release this incomplete buying path.
2. Verify a restorable, fresh pre-change database backup. The observed daily physical backup is not a current logical export or a completed restoration test. Code ZIPs and diagnostic CSVs are not database backups.
3. Use a controlled rollout window and retain the current published app URL. No paid Supabase branch/project/PITR is authorized.
4. Run all local tests with fictional accounts. Local PostgreSQL mimics the audited schema and roles, not the complete hosted Supabase Auth/email/PostgREST stack.
5. After local validation, the owner must explicitly perform each guided Supabase action and confirm completion before the next dependent action. Do not ask the owner to paste real keys/passwords into chat.

## Guided deployment order (not yet executed)

1. Run `001_prepare_access.sql` once, after backup and inventory confirmation. It is a transaction; timeout, mismatch or failure must be investigated instead of blindly rerunning. It adds authorization machinery and tightens unsafe table grants, but does not yet change budget RLS to require entitlement.
2. Read and verify the results with `verify_access.sql`; confirm the same five accounts are permanent and budgets exist. Activation registry is still empty; no production key needs to exist yet.
3. Publish a pinned test revision of the new application without replacing Hostinger's current link. The existing redirect allowlist covers repository revisions. Test hosted email confirmation, a fictional DEMO account and conversion using a dedicated test commercial link. Use the actual Auth flow, never production account passwords in scripts.
4. Re-audit inventory and take/verify a fresh backup at the enforcement window. Apply `002_enforce_access.sql` only after the new client passes. Its policies gate every budget read/write with database time. Existing permanent accounts remain compatible with old app URLs.
5. Switch Hostinger's app link and Supabase Site URL to the tested pinned application URL. Do not leave Site URL pointing at old revision `ff82021`. Keep redirects exact/scoped to this app; never use a global wildcard.
6. Create a NEW production commercial link for the Etsy document. No test link should be shipped. Disable test links. Deliver the real link privately to the owner, never commit it.
7. Verify normal sign-in and saved-budget recovery, both languages, demo expiry, link revocation and account conversion before updating the Etsy product document.

Old revisions do not call the new access RPC. Their browser-only controls cannot be retrofitted remotely. The final server policies block expired/uninitialized DEMOs even through old URLs, while old clients may show a loading/error/default screen. Direct users to the new revision.

## Operator functions (examples of signatures, not commands to run now)

- `public.sb_create_commercial_link(label)` returns the link ID and a plaintext key **once**. The owner builds `PINNED_APP_URL#commercial=KEY` privately. Replacing/rotating a link requires generating a new key, then disabling the old one and updating Etsy's document.
- `public.sb_set_commercial_link_enabled(link_id, enabled)` changes future-redemption availability only.
- `public.sb_admin_set_access(user_id, type, expires_at)` grants a type/date to an existing account, preserving its budget. COMMERCIAL + NULL expiry is Lifetime. Only a verified admin/operator can call it.
- `sb_private.access_settings` holds DEMO days and ONE current commercial term (`LIFETIME` initially; `1_YEAR` only if the owner changes the policy). Link issuance captures that term. Editing this setting cannot modify already-issued licenses.
- Link conditions are fixed at issue time. If changing future sale terms, issue a new link and update the Etsy document. A shared link cannot distinguish a late old purchaser from a new recipient; do not silently reinterpret older Lifetime links or grants.
- Query `sb_private.commercial_activations` joined to profiles/links to review the account, source link, activation time and granted condition. Admin changes are recorded in `sb_private.access_events`.

After first activation, users need only normal sign-in. If email confirmation opens on another device/browser without the pending key, open the original document's commercial link again and sign into the same account. Do not create another account.

## Failure handling and recovery

- 001/002 each use a transaction and short lock timeout; errors must leave that transaction unapplied. Confirm rollback state in the operator session before trying again.
- Do not drop access columns/tables, overwrite current profiles with an old snapshot, or delete Auth users to recover access. New license grants and budgets must be retained.
- Prefer correcting authorization/app configuration with preserved data. Code rollback alone does not revert database policy changes.
- `rollback_002_enforcement.sql` restores the previous **weaker** ownership-only budget policies. It can reopen expired-account API access and therefore needs explicit operator review. It does not delete data/licenses or restore unsafe TRUNCATE grants. It is not an automatic production rollback.
- Full physical database restoration is a separate emergency operation that may lose post-backup writes and interrupt the service. Never click Restore merely to test or inspect a backup.

## Local tests

The local container is `smart_budget_access_test_20261101`, label `codex.task=smart-budget-access`, no published ports/network. It uses the already installed `postgres:16` image. Existing restaurant containers are outside scope.

Run `powershell -NoProfile -ExecutionPolicy Bypass -File tests/run-access-database.ps1`, then `node --test tests/access-control.test.mjs` and `node tests/access-browser.cjs`.

The database suite uses isolated `sb_access_test_*` databases, real RLS roles and concurrency checks. The browser suite blocks HTTPS and substitutes a fake Supabase module, exercising server-before-budget ordering, stale account responses, failure gates, queued saves and bilingual screens. No real account or production network is used by these tests.
