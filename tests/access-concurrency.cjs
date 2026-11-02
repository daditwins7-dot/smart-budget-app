const { execFileSync, execFile } = require('node:child_process');
const assert = require('node:assert/strict');
const [container, database] = process.argv.slice(2);
if (container !== 'smart_budget_access_test_20261101' || !/^sb_access_test_\d+_\d+$/.test(database || '')) throw new Error('Local test target required');
const args = sql => ['exec', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-c', sql];
const run = sql => execFileSync('docker', args(sql), { encoding: 'utf8' }).trim();
const asyncRun = sql => new Promise((resolve, reject) => execFile('docker', args(sql), { encoding: 'utf8' }, (error, out) => error ? reject(error) : resolve(out.trim())));
const uid = '00000000-0000-0000-0000-000000000020';
(async () => {
  run(`insert into auth.users(id,email,email_confirmed_at) values('${uid}','concurrent@example.test',now());
    update budget_states set state='{"preserved":true}' where user_id='${uid}';`);
  const grant = `select sb_admin_grant_lifetime('concurrent@example.test','${uid}');`;
  const results = (await Promise.all([asyncRun(grant), asyncRun(grant)])).map(value => JSON.parse(value));
  assert.equal(results.filter(result => result.changed).length, 1);
  assert.ok(results.every(result => result.access_type === 'COMMERCIAL' && result.access_expires_at === null));
  assert.equal(run(`select count(*) from sb_private.access_events where user_id='${uid}' and event='manual_commercial_granted'`), '1');
  assert.equal(run(`select state->>'preserved' from budget_states where user_id='${uid}'`), 'true');

  const fresh = '00000000-0000-0000-0000-000000000021';
  run(`insert into auth.users(id,email,email_confirmed_at) values('${fresh}','before-change@example.test',now());`);
  const changeEmail = asyncRun(`begin; update auth.users set email='after-change@example.test' where id='${fresh}';
    select pg_advisory_xact_lock(41101); select pg_sleep(2); commit;`);
  let locked = false;
  for (let i = 0; i < 20 && !locked; i++) {
    locked = run(`select exists(select 1 from pg_locks where locktype='advisory' and objid=41101 and granted)`) === 't';
    if (!locked) await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.ok(locked, 'Identity update has acquired its lock');
  await assert.rejects(asyncRun(`select sb_admin_grant_lifetime('before-change@example.test','${fresh}');`), /Account changed; review it again/);
  await changeEmail;
  assert.equal(run(`select access_type from profiles where user_id='${fresh}'`), 'DEMO');
  assert.equal(run(`select count(*) from sb_private.access_events where user_id='${fresh}' and event='manual_commercial_granted'`), '0');
  console.log('PASS: concurrent manual grants are idempotent; identity changes prevent stale-email activation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
