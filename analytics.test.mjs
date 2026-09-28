import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics } from './analytics.mjs';

const config = { enabled: true, projectToken: 'phc_testonly', apiHost: 'https://eu.i.posthog.com', allowedOrigin: 'https://duman-sadu.github.io' };
function fixture(storage = new Map()) {
  const requests = [];
  let serial = 0;
  return { requests, storage, env: {
    Date, location: { origin: config.allowedOrigin }, navigator: {},
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}` },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    fetch: (url, options) => { requests.push({ url, ...options, payload: JSON.parse(options.body) }); return Promise.resolve({ ok: true }); },
  } };
}

test('disabled, unconfigured and local games send nothing and store no identifier', () => {
  for (const patch of [{ enabled: false }, { projectToken: '' }, { projectToken: 'phx_secret' }, { apiHost: 'http://example.com' }, { allowedOrigin: 'https://other.example' }]) {
    const f = fixture();
    const analytics = createAnalytics({ ...config, ...patch }, f.env);
    assert.equal(analytics.enabled, false);
    assert.equal(analytics.track('page_view'), false);
    assert.equal(f.requests.length, 0);
    assert.equal(f.storage.size, 0);
  }
});

test('only allowed metrics are sent, never player names or challenge URLs', () => {
  const f = fixture();
  const analytics = createAnalytics(config, f.env);
  analytics.track('game_finished', { name: 'Әлия', url: 'https://example.com/#name=Әлия', score: 123, level: 2, correct: 3, reason: 'timeout', duration_ms: 12000, $ip: '1.2.3.4', challenge: true });
  const request = f.requests[0];
  assert.equal(request.url, 'https://eu.i.posthog.com/i/v0/e/');
  assert.equal(request.referrerPolicy, 'no-referrer');
  assert.equal(request.credentials, 'omit');
  assert.equal(request.keepalive, true);
  assert.equal(request.payload.properties.score, 123);
  assert.equal(request.payload.properties.reason, 'timeout');
  assert.equal(request.payload.properties.$process_person_profile, false);
  assert.equal(request.payload.properties.$ip, '0.0.0.0');
  assert.ok(!request.body.includes('Әлия'));
  assert.equal(analytics.track('unapproved_event'), false);
});

test('one page view per load, stable visitor ID across loads and returning-day detection', () => {
  const f = fixture();
  const analytics = createAnalytics(config, f.env);
  analytics.track('page_view');
  assert.equal(analytics.track('page_view'), false);
  const visitorId = f.requests[0].payload.distinct_id;
  assert.equal(f.requests[0].payload.properties.returning_visitor, false);
  const stored = JSON.parse(f.storage.get('123-analytics-visitor-v1'));
  stored.createdAt -= 2 * 86400000;
  f.storage.set('123-analytics-visitor-v1', JSON.stringify(stored));
  createAnalytics(config, f.env).track('page_view');
  assert.equal(f.requests[1].payload.distinct_id, visitorId);
  assert.equal(f.requests[1].payload.properties.returning_visitor, true);
});

test('blocked storage, offline fetch and privacy preferences do not break the game', async () => {
  const f = fixture();
  f.env.localStorage.getItem = () => { throw new Error('Blocked'); };
  f.env.localStorage.setItem = () => { throw new Error('Blocked'); };
  f.env.fetch = () => Promise.reject(new Error('Offline'));
  assert.doesNotThrow(() => createAnalytics(config, f.env).track('page_view'));
  await Promise.resolve();
  f.env.fetch = () => { throw new Error('Blocked'); };
  assert.equal(createAnalytics(config, f.env).track('page_view'), false);
  f.env.navigator.doNotTrack = '1';
  assert.equal(createAnalytics(config, f.env).enabled, false);
  f.env.navigator = { globalPrivacyControl: true };
  assert.equal(createAnalytics(config, f.env).enabled, false);
});

test('expired identifiers are rotated instead of linking visitors indefinitely', () => {
  const f = fixture(new Map([['123-analytics-visitor-v1', JSON.stringify({ id: '12345678-1234-4123-8123-123456789012', createdAt: Date.now() - 91 * 86400000 })]]));
  createAnalytics(config, f.env).track('page_view');
  assert.notEqual(f.requests[0].payload.distinct_id, '12345678-1234-4123-8123-123456789012');
});
