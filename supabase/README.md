# Manual DEMO / COMMERCIAL access

Status: local implementation only. Do not apply SQL or publish until the operator-guided stage.
This supersedes the earlier automatic activation design, which was never deployed.

## Approved workflow

Etsy handles payment and delivers a PDF with the ordinary app URL. Every new account receives normal DEMO access after email verification. The customer supplies their Smart Budget account email and Etsy purchase evidence outside the application. The owner verifies the purchase manually in Etsy, then grants COMMERCIAL Lifetime to the SAME account in Supabase. The user continues with normal email/password sign-in.

The PDF URL cannot confer commercial privileges. There are no commercial activation keys, link registries, automatic commercial-redemption endpoints, customer activation buttons, annual commercial policy or Etsy integration.

## Model and safeguards

- `profiles.access_type`: DEMO or COMMERCIAL, separate from administrator role.
- DEMO is 30 days from the first verified access, initialized once by the server under a profile lock. Its expiration uses database time. Closing/reopening sessions cannot restart it.
- COMMERCIAL is Lifetime only, with no expiration. The database constraint prevents a commercial expiration date in this version.
- Five approved active accounts remain permanent, preserving their IDs and administrator role. The original expired/unconfirmed account retains its existing dates.
- Migration validates the audited account fingerprint before changing schema/data and stops on inventory drift.
- `access_source` distinguishes normal, legacy and administrative grants. A private audit log records manual conversions, previous/new access, timestamp and actor ID/database principal.
- Private settings store only DEMO duration. There is no configurable commercial plan in this version.
- Server authorization precedes budget reads. RLS checks ownership and access on every protected database operation. Anonymous and ordinary users cannot update access fields or grant privileges.
- Expiration never deletes Auth users, profiles, budgets or transactions. A denied/failed read is never replaced with a default-budget write.
- Existing browser copies of previously loaded data cannot be withdrawn. The new controls protect normal app use and server reads/writes.

## Safe manual operation (after deployment)

1. Verify the purchase in Etsy and obtain the email the buyer used in Smart Budget. No purchase automation or customer code is involved.
2. In Supabase SQL Editor, run `admin_find_account.sql` with that email. Require one account, verified email, matching profile email and DEMO type. Record its `user_id` and verify its existing budget row. A missing/ambiguous/mismatched/blocked account needs review, not a forced update.
3. Run `admin_grant_lifetime.sql` with that email AND the reviewed `user_id`. The server locks and rechecks identity/profile, changes only access fields to COMMERCIAL/active/no expiry, and records the grant atomically. It never writes to `budget_states` or creates an Auth account.
4. Run the same lookup again: expect COMMERCIAL, active, NULL expiration and the same `user_id`/budget row. `changed=true` identifies a new grant; repeating a valid grant returns `changed=false` without duplicate audit events or shortened rights.
5. The customer signs in normally. An already-open DEMO session picks up the grant on its next access check. An expired session can use Check access again without registering another account.

Both administrative functions require either a verified existing app administrator or an actual trusted database operator session. Possession of the email/UUID does not authorize the caller. A COMMERCIAL license does not confer the administrator role. Purchase evidence is checked manually outside Smart Budget; the function does not pretend to verify an Etsy payment.

## Deployment sequence - not executed

1. Confirm fresh, restorable database protection and the approved account inventory. The known daily physical backups and code ZIPs do not by themselves prove an up-to-date logical backup or tested restoration. Obtain the complementary application-data/configuration export before live changes. No paid branch/project/PITR is authorized.
2. Apply `001_prepare_access.sql` once in the guided window. It runs in a transaction, preserves existing rights, adds DEMO/manual-grant functions and limits unsafe grants. If it fails, stop and inspect rollback state; do not blindly retry.
3. Verify permanent accounts, roles and budget presence using `verify_access.sql`.
4. Publish a pinned test revision of the client without changing Hostinger's current URL. Test the real hosted email-confirmation/sign-in flow with designated test accounts and grant Lifetime manually to a test DEMO. Local mocks do not replace this check.
5. At the enforcement window, recheck inventory and backups, then apply `002_enforce_access.sql`. Verify RLS with actual user sessions.
6. Only after those checks, switch Hostinger and Supabase Site URL to the tested pinned app URL. Keep the previous app available as a code reference. Existing redirects are scoped to this app repository; do not add a global wildcard.
7. Etsy's PDF receives the ordinary app URL plus instructions to submit the account email and purchase proof for manual activation. It never needs a private activation URL. Updating Etsy/Hostinger is an owner-guided stage, not part of local development.

`src/config/access.js` optionally supplies the actual Etsy listing URL for the Buy on Etsy button. An empty value hides the button; manual administration does not depend on it. Do not invent a listing or publish an unverified buying path.

Old client revisions do not initialize the new server DEMO. Final RLS still denies expired/uninitialized DEMO reads through old URLs, but their legacy screens may be confusing. Direct customers to the new ordinary app URL.

## Recovery

Keep code backups and current database backups separately. Do not delete Auth users, drop access columns, replace current profiles from an old snapshot, or restore the whole database merely to inspect a backup.

`rollback_002_enforcement.sql` is an emergency-only return to the previous weaker ownership policies. It preserves accounts, grants and budgets, but can reopen expired-account API access. It requires operator review and is never automatic. Correcting authorization/configuration while preserving data is preferred. A full physical restore is a separate downtime/data-loss decision.

## Local tests

The isolated container `smart_budget_access_test_20261101` uses the existing postgres:16 image, has no network or published ports, and only contains fake accounts. Existing restaurant containers are outside scope.

Run `powershell -NoProfile -ExecutionPolicy Bypass -File tests/run-access-database.ps1`, `node --test tests/access-control.test.mjs` and `node tests/access-browser.cjs`.

Coverage: legacy Lifetime preservation; one-time 30-day DEMO; expired reads/writes blocked with retained data; self-upgrade denied; case-normalized email lookup; missing/duplicate/wrong-ID/unverified/mismatched/blocked-account rejection; verified administrator conversion; unchanged budget and user ID; idempotent/concurrent grants; identity-change race protection; bilingual screens; normal registration; subsequent sign-in recovery; in-session manual upgrade; account races, failure gates and unfinished-form preservation. Browser tests block external HTTPS and use a fake Supabase client.
