const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const runtime = process.env.PLAYWRIGHT_MODULE || 'C:/Users/rmart/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(runtime);
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '../../backups/access-check');
fs.mkdirSync(output, { recursive: true });
const fixture = fs.readFileSync(path.join(__dirname, 'access-browser-fixture.js'), 'utf8');
const token = 'a'.repeat(64); // Fake local test key; not a production activation secret.
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const errors = [];
    const makePage = async (options = {}, fragment = '') => {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(options => { window.__accessTestOptions = options; }, options);
      await page.route('**/services/supabaseClient.js*', route => route.fulfill({ contentType: 'text/javascript', body: fixture }));
      await page.route('https://**', route => route.abort());
      await page.goto(origin + '/' + fragment);
      return page;
    };
    const expired = { allowed: false, reason: 'expired', access_type: 'DEMO', expires_at: '2026-01-01T00:00:00Z', remaining_seconds: 0 };
    const page = await makePage();
    await page.waitForSelector('[data-page="dashboard"]');
    const log = await page.evaluate(() => __accessMock.events);
    assert.ok(log.indexOf('sb_access_status') < log.indexOf('budget:first'), 'Server authorization precedes budget read');
    await page.locator('[data-page="transactions"]').click();
    await page.locator('[name="comment"]').fill('Unfinished comment');
    const checksBefore = await page.evaluate(() => __accessMock.events.filter(e => e === 'sb_access_status').length);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(n => __accessMock.events.filter(e => e === 'sb_access_status').length > n, checksBefore);
    await page.waitForTimeout(60);
    assert.equal(await page.locator('[name="comment"]').inputValue(), 'Unfinished comment', 'Background checks preserve unfinished form');
    for (const language of ['es','en']) {
      await page.locator('[data-language]').first().selectOption(language);
      for (const id of ['dashboard','budget','transactions','projections','history','smartModel','evaluation','help','settings']) {
        await page.locator(`[data-page="${id}"]`).click();
        if (id === 'budget') assert.equal(await page.locator('[data-line="0"][data-prop="concept"]').inputValue(), 'Income first <literal>');
        if (id === 'transactions') assert.equal(await page.locator('.transaction-list tbody tr td').nth(5).innerText(), 'Savings <keep literal>');
        if (id === 'help') {
          await page.locator('[name="question"]').fill('Why are Savings low?');
          await page.locator('#help-form').evaluate(form => form.requestSubmit());
          assert.equal(await page.locator('.help-user p').last().innerText(), 'Why are Savings low?');
        }
      }
    }
    await page.close();
    for (const options of [{ status: expired }, { status: { allowed: false, reason: 'profile_missing' } }, { statusError: true }, { budgetError: true }, { unconfigured: true }]) {
      const p = await makePage(options);
      await p.waitForSelector('.auth-card');
      await p.waitForTimeout(80);
      assert.equal(await p.locator('.dashboard-board').count(), 0);
      const state = await p.evaluate(() => ({ events: __accessMock.events, writes: __accessMock.writes }));
      assert.equal(state.writes.length, 0, 'Denied/failed access never writes a default budget');
      if (!options.budgetError) assert.ok(!state.events.some(event => typeof event === 'string' && event.startsWith('budget:')));
      if (options.statusError) {
        await p.evaluate(() => { __accessMock.statusError = false; });
        await p.locator('[data-retry-access]').click();
        await p.waitForSelector('.dashboard-board');
      }
      if (options.status) {
        await p.locator('[data-language]').selectOption('es');
        await p.setViewportSize({ width: 390, height: 844 });
        await p.screenshot({ path: path.join(output, `${options.status.reason}-es.png`), fullPage: true });
      }
      await p.close();
    }
    const activation = await makePage({ status: expired }, `#commercial=${token}`);
    await activation.waitForSelector('[data-activate-commercial]');
    assert.ok(!activation.url().includes(token), 'Secret removed from visible URL');
    assert.equal(await activation.locator('.dashboard-board').count(), 0);
    await activation.locator('[data-language]').selectOption('es');
    await activation.setViewportSize({ width: 390, height: 844 });
    await activation.screenshot({ path: path.join(output, 'activate-es.png'), fullPage: true });
    await activation.locator('[data-activate-commercial]').click();
    await activation.waitForSelector('.dashboard-board');
    assert.equal(await activation.evaluate(() => localStorage.getItem('smart-budget-pending-commercial')), null);
    assert.match(await activation.locator('.account-bar').innerText(), /por vida/);
    await activation.locator('[data-page="budget"]').click();
    assert.equal(await activation.locator('[data-line="0"][data-prop="concept"]').inputValue(), 'Income first <literal>');
    await activation.locator('[data-sign-out]').click();
    await activation.waitForSelector('#auth-form');
    assert.equal(await activation.locator('.workspace').count(), 0);
    await activation.close();
    const disabled = await makePage({ status: expired, activationReason: 'link_disabled' }, `#commercial=${token}`);
    await disabled.waitForSelector('[data-activate-commercial]');
    await disabled.locator('[data-activate-commercial]').click();
    await disabled.waitForFunction(() => document.body.innerText.includes('invalid or disabled'));
    assert.equal(await disabled.locator('.workspace').count(), 0);
    assert.equal(await disabled.evaluate(() => __accessMock.writes.length), 0);
    await disabled.close();
    const registration = await makePage({ signedOut: true }, `#commercial=${token}`);
    await registration.waitForSelector('#auth-form');
    await registration.locator('[data-auth-mode]').click();
    await registration.locator('[name="email"]').fill('buyer@example.test');
    await registration.locator('[name="password"]').fill('test-password-only');
    await registration.locator('#auth-form').evaluate(form => form.requestSubmit());
    await registration.waitForFunction(() => __accessMock.events.some(e => e.signup));
    const signup = await registration.evaluate(() => __accessMock.events.find(e => e.signup));
    assert.ok(!signup.signup.emailRedirectTo.includes(token), 'Confirmation URL does not leak commercial token');
    await registration.evaluate(() => __accessMock.emit('first'));
    await registration.waitForSelector('[data-activate-commercial]');
    assert.equal(await registration.evaluate(() => __accessMock.events.filter(e => typeof e === 'string' && e.startsWith('budget:')).length), 0);
    await registration.close();
    const sessionRace = await makePage({ budgetDelay: 250 });
    await sessionRace.waitForFunction(() => __accessMock.events.includes('budget:first'));
    await sessionRace.evaluate(() => __accessMock.emit('second'));
    await sessionRace.waitForSelector('.dashboard-board');
    await sessionRace.locator('[data-page="budget"]').click();
    assert.equal(await sessionRace.locator('[data-line="0"][data-prop="concept"]').inputValue(), 'Income second <literal>', 'Stale first-account response is ignored');
    await sessionRace.close();
    const saveFailure = await makePage();
    await saveFailure.waitForSelector('.dashboard-board');
    await saveFailure.evaluate(() => { __accessMock.saveError = true; });
    await saveFailure.locator('[data-page="budget"]').click();
    await saveFailure.locator('[data-field="regularIncome"]').fill('12345');
    await saveFailure.locator('[data-field="regularIncome"]').dispatchEvent('change');
    await saveFailure.waitForSelector('.access-card');
    assert.match(await saveFailure.locator('.auth-message').innerText(), /could not be saved/);
    await saveFailure.close();
    const expiry = await makePage();
    await expiry.waitForSelector('.dashboard-board');
    await expiry.locator('[data-page="budget"]').click();
    await expiry.locator('[data-field="regularIncome"]').fill('12345');
    await expiry.locator('[data-field="regularIncome"]').dispatchEvent('change');
    await expiry.evaluate(status => { __accessMock.status = status; window.dispatchEvent(new Event('focus')); }, expired);
    await expiry.waitForSelector('.access-card');
    await expiry.waitForTimeout(550);
    assert.equal(await expiry.evaluate(() => __accessMock.writes.length), 0, 'Expiry cancels queued writes');
    await expiry.close();
    assert.deepEqual(errors, []);
    console.log('PASS: bilingual views, server-before-budget ordering, conversion, expired/missing/offline/error gates, token handling, account races and queued-save cancellation.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
