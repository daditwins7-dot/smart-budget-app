import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAccessStatus, accessDeadline } from '../src/services/accessControl.js';
test('access fails closed on incomplete or malformed server responses', () => {
  for (const value of [null, {}, { allowed: true, reason: 'ok' },
    { allowed: true, reason: 'ok', access_type: 'DEMO', expires_at: null },
    { allowed: true, reason: 'ok', access_type: 'DEMO', expires_at: 'date', remaining_seconds: -1 },
    { allowed: true, reason: 'ok', access_type: 'DEMO', expires_at: 'date', remaining_seconds: Infinity }]) {
    assert.throws(() => normalizeAccessStatus(value));
  }
});
test('the current commercial condition is Lifetime only', () => {
  assert.throws(() => normalizeAccessStatus({ allowed: true, reason: 'ok', access_type: 'COMMERCIAL', expires_at: '2030-01-01', remaining_seconds: 30 }));
  const status = { allowed: true, reason: 'ok', access_type: 'COMMERCIAL', expires_at: null };
  assert.equal(normalizeAccessStatus(status), status);
  assert.equal(accessDeadline(status, 100), Infinity);
});
test('DEMO expiry uses server duration and monotonic elapsed time, not calendar clock', () => {
  const status = { allowed: true, reason: 'ok', access_type: 'DEMO', expires_at: '2030-01-01T00:00:00Z', remaining_seconds: 30 };
  assert.equal(accessDeadline(normalizeAccessStatus(status), 100, 200), 29900);
  assert.equal(accessDeadline(status, 100, 40000), 100);
});
