import test from 'node:test';
import assert from 'node:assert/strict';
import { readCommercialToken, clearCommercialToken, normalizeAccessStatus, accessDeadline } from '../src/services/accessControl.js';
const key = 'smart-budget-pending-commercial';
const secret = 'a'.repeat(64);
const storage = () => {
  const values = new Map();
  return { getItem: name => values.get(name), setItem: (name, value) => values.set(name, value), removeItem: name => values.delete(name) };
};
test('commercial link is remembered and removed from the URL without removing auth parameters', () => {
  const data = storage(); let target;
  const location = { pathname: '/index.html', search: '?page=dashboard', hash: `#commercial=${secret}&access_token=opaque&token_type=bearer` };
  assert.equal(readCommercialToken(location, data, { replaceState: (_, __, url) => { target = url; } }), secret);
  assert.ok(!target.includes(secret));
  assert.ok(target.includes('access_token=opaque'));
  assert.equal(data.getItem(key), secret);
  assert.equal(readCommercialToken({ ...location, hash: '' }, data, {}), secret);
  clearCommercialToken(data);
  assert.equal(readCommercialToken({ ...location, hash: '' }, data, {}), '');
});
test('an invalid supplied key never revives an old pending activation', () => {
  const data = storage(); data.setItem(key, secret);
  assert.equal(readCommercialToken({ pathname: '/', search: '', hash: '#commercial=invalid' }, data, { replaceState() {} }), '');
  assert.equal(data.getItem(key), undefined);
});
test('unavailable storage still permits same-tab activation', () => {
  const data = { setItem() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); } };
  assert.equal(readCommercialToken({ pathname: '/', search: '', hash: `#commercial=${secret}` }, data, { replaceState() {} }), secret);
  assert.equal(readCommercialToken({ hash: '' }, data, {}), '');
});
test('access fails closed on incomplete or malformed server responses', () => {
  for (const value of [null, {}, { allowed: true, reason: 'ok' }, { allowed: true, reason: 'ok', access_type: 'DEMO', expires_at: null },
    { allowed: true, reason: 'ok', access_type: 'DEMO', expires_at: 'date', remaining_seconds: -1 }]) {
    assert.throws(() => normalizeAccessStatus(value));
  }
});
test('client expiry uses server duration and monotonic elapsed time, not calendar clock', () => {
  const status = { allowed: true, reason: 'ok', access_type: 'DEMO', expires_at: '2030-01-01T00:00:00Z', remaining_seconds: 30 };
  assert.equal(accessDeadline(normalizeAccessStatus(status), 100, 200), 29900);
  assert.equal(accessDeadline({ ...status, access_type: 'COMMERCIAL', expires_at: null }, 100), Infinity);
});
