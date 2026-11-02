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
    const activation = await makePage({ status: expired });
    await activation.waitForSelector('[data-retry-access]');
    assert.equal(await activation.locator('.dashboard-board').count(), 0);
    assert.equal(await activation.locator('[data-activate-commercial]').count(), 0, 'No customer self-activation action');
    await activation.locator('[data-language]').selectOption('es');
    await activation.setViewportSize({ width: 390, height: 844 });
    assert.match(await activation.locator('.access-card').innerText(), /comprobante de compra/);
    await activation.screenshot({ path: path.join(output, 'manual-activation-es.png'), fullPage: true });
    // Simulates an external administrator after Etsy verification, not an app activation API.
    await activation.evaluate(() => { __accessMock.status = { allowed: true, reason: 'ok', access_type: 'COMMERCIAL', expires_at: null, remaining_seconds: null }; });
    await activation.locator('[data-retry-access]').click();
    await activation.waitForSelector('.dashboard-board');
    assert.match(await activation.locator('.account-bar').innerText(), /por vida/);
    await activation.locator('[data-page="budget"]').click();
    assert.equal(await activation.locator('[data-line="0"][data-prop="concept"]').inputValue(), 'Income first <literal>');
    await activation.locator('[data-sign-out]').click();
    await activation.waitForSelector('#auth-form');
    assert.equal(await activation.locator('.workspace').count(), 0);
    await activation.locator('[name="email"]').fill('first@example.test');
    await activation.locator('[name="password"]').fill('test-password-only');
    await activation.locator('#auth-form').evaluate(form => form.requestSubmit());
    await activation.waitForSelector('.workspace');
    assert.equal(await activation.locator('[data-line="0"][data-prop="concept"]').inputValue(), 'Income first <literal>');
    assert.match(await activation.locator('.account-bar').innerText(), /por vida/);
    await activation.close();
    const demo = { allowed: true, reason: 'ok', access_type: 'DEMO', expires_at: '2030-01-01T00:00:00Z', remaining_seconds: 2592000 };
    const registration = await makePage({ signedOut: true, status: demo }, '?access_type=COMMERCIAL');
    await registration.waitForSelector('#auth-form');
    await registration.locator('[data-auth-mode]').click();
    await registration.locator('[name="email"]').fill('buyer@example.test');
    await registration.locator('[name="password"]').fill('test-password-only');
    await registration.locator('#auth-form').evaluate(form => form.requestSubmit());
    await registration.waitForFunction(() => __accessMock.events.some(e => e.signup));
    await registration.evaluate(() => __accessMock.emit('first'));
    await registration.waitForSelector('.dashboard-board');
    assert.match(await registration.locator('.account-bar').innerText(), /DEMO access ends/);
    const rpcs = await registration.evaluate(() => __accessMock.events.filter(e => typeof e === 'string' && e.startsWith('sb_')));
    assert.ok(rpcs.every(name => name === 'sb_access_status'), 'Registration never asks for commercial privileges');
    await registration.close();
    const activeDemo = await makePage({ status: demo });
    await activeDemo.waitForSelector('.dashboard-board');
    await activeDemo.locator('[data-page="transactions"]').click();
    await activeDemo.locator('[name="comment"]').fill('Draft before manual grant');
    const readsBefore = await activeDemo.evaluate(() => __accessMock.events.filter(e => typeof e === 'string' && e.startsWith('budget:')).length);
    await activeDemo.evaluate(() => {
      __accessMock.status = { allowed: true, reason: 'ok', access_type: 'COMMERCIAL', expires_at: null, remaining_seconds: null };
      window.dispatchEvent(new Event('focus'));
    });
    await activeDemo.waitForFunction(() => document.querySelector('.account-bar').innerText.includes('Lifetime'));
    assert.equal(await activeDemo.locator('[name="comment"]').inputValue(), 'Draft before manual grant');
    assert.equal(await activeDemo.evaluate(() => __accessMock.events.filter(e => typeof e === 'string' && e.startsWith('budget:')).length), readsBefore);
    await activeDemo.close();
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
    console.log('PASS: bilingual views, normal DEMO registration, external manual conversion, saved budget recovery, server-first access, failure gates and account races.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
