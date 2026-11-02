const { execFileSync, execFile } = require('node:child_process');
const assert = require('node:assert/strict');
const [container, database] = process.argv.slice(2);
if (container !== 'smart_budget_access_test_20261101' || !/^sb_access_test_\d+_\d+$/.test(database || '')) throw new Error('Local test target required');
const args = sql => ['exec', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-c', sql];
const run = sql => execFileSync('docker', args(sql), { encoding: 'utf8' }).trim();
const asyncRun = sql => new Promise((resolve, reject) => execFile('docker', args(sql), { encoding: 'utf8' }, (error, out) => error ? reject(error) : resolve(out.trim())));
const uid = '00000000-0000-0000-0000-000000000010';
const redeem = `set role authenticated; set "request.jwt.claim.sub"='${uid}'; select sb_activate_commercial(repeat('b',64));`;
(async () => {
  run(`insert into auth.users(id,email,email_confirmed_at) values('${uid}','concurrent@example.test',now());
    insert into sb_private.commercial_links(label,token_hash,commercial_term) values('concurrency',extensions.digest(repeat('b',64),'sha256'),'LIFETIME');`);
  const [first, second] = await Promise.all([asyncRun(redeem), asyncRun(redeem)]);
  assert.ok(JSON.parse(first).activated && JSON.parse(second).activated);
  assert.equal(run(`select count(*) from sb_private.commercial_activations where user_id='${uid}'`), '1');
  const fresh = '00000000-0000-0000-0000-000000000011';
  run(`insert into auth.users(id,email,email_confirmed_at) values('${fresh}','revocation-race@example.test',now());`);
  const disable = asyncRun(`begin; update sb_private.commercial_links set enabled=false where label='concurrency';
    select pg_advisory_xact_lock(41101); select pg_sleep(2); commit;`);
  let locked = false;
  for (let i = 0; i < 20 && !locked; i++) {
    locked = run(`select exists(select 1 from pg_locks where locktype='advisory' and objid=41101 and granted)`) === 't';
    if (!locked) await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.ok(locked, 'Disable operation acquired its lock');
  const blocked = await asyncRun(`set role authenticated; set "request.jwt.claim.sub"='${fresh}'; select sb_activate_commercial(repeat('b',64));`);
  await disable;
  assert.equal(JSON.parse(blocked).reason, 'link_disabled');
  assert.equal(run(`select access_type from profiles where user_id='${fresh}'`), 'DEMO');
  assert.equal(run(`select access_expires_at is null from profiles where user_id='${uid}'`), 't');
  console.log('PASS: concurrent redemption grants once; link revocation serializes with new activations.');
})().catch(error => { console.error(error); process.exitCode = 1; });
