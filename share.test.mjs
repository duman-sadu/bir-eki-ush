import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, gameUrl, shareText, whatsappUrl, readChallenge, challengeUrl } from './game.mjs';

test('Kazakh names are preserved, empty names get a fallback and multiline names are normalized', () => {
  assert.equal(normalizeName('  Әлия   Өмірбек  '), 'Әлия Өмірбек');
  assert.equal(normalizeName(' \n '), 'Ойыншы');
  assert.equal(normalizeName('Әлия\nҰпай: 999'), 'Әлия Ұпай: 999');
  assert.equal(normalizeName('а'.repeat(100)).length, 32);
});

test('share text contains the actual result and survives WhatsApp URL encoding', () => {
  const text = shareText({ name: 'Әлия & Әділ #1', score: 3750, correct: 12, level: 5, address: 'https://example.com/game/?private=1#fragment' });
  assert.ok(text.includes('Әлия & Әділ #1'));
  assert.ok(text.includes(new Intl.NumberFormat('kk-KZ').format(3750)));
  assert.ok(text.includes('Деңгей: 5 · Дұрыс жауап: 12'));
  const challengeLink = text.split('Ойна: ')[1];
  assert.equal(gameUrl(challengeLink), 'https://example.com/game/');
  assert.deepEqual(readChallenge(challengeLink), { name: 'Әлия & Әділ #1', score: 3750 });
  assert.ok(!challengeLink.includes('private='));
  const url = new URL(whatsappUrl(text));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.searchParams.get('text'), text);
  assert.equal(url.searchParams.size, 1);
});

test('game link is included with the result on local and public hosts', () => {
  for (const address of ['http://localhost:3213/', 'http://127.0.0.1:3213/', 'http://192.168.1.2:3213/', 'https://example.com/game/']) {
    assert.equal(gameUrl(address), address);
    const text = shareText({ name: '', score: 0, correct: 0, level: 1, address });
    assert.ok(text.includes('Ойыншы: Ойыншы'));
    assert.ok(text.includes('Ұпай: 0'));
    assert.equal(gameUrl(text.split('Ойна: ')[1]), address);
    assert.deepEqual(readChallenge(text.split('Ойна: ')[1]), { name: 'Ойыншы', score: 0 });
    assert.equal(new URL(whatsappUrl(text)).searchParams.get('text'), text);
  }
});

test('invalid challenge scores are ignored and names are bounded', () => {
  for (const score of ['', '-1', 'NaN', 'Infinity', '1.5', '1e3', '1000000000000', ' 3']) {
    assert.equal(readChallenge(`https://example.com/#challenge=1&score=${encodeURIComponent(score)}`), null);
  }
  assert.equal(readChallenge('https://example.com/'), null);
  assert.equal(readChallenge('invalid'), null);
  assert.equal(readChallenge('https://example.com/#challenge=2&score=50'), null);
  assert.deepEqual(readChallenge(challengeUrl('https://example.com/', 'Ә'.repeat(50), 500)), { name: 'Ә'.repeat(32), score: 500 });
});

test('invalid addresses and non-web protocols are not shared as game links', () => {
  for (const address of ['file:///game/index.html', 'javascript:alert(1)', 'invalid']) {
    assert.equal(gameUrl(address), '');
  }
});
