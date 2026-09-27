import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, gameUrl, shareText, whatsappUrl } from './game.mjs';

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
  assert.ok(text.endsWith('Ойна: https://example.com/game/'));
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
    assert.ok(text.endsWith(`Ойна: ${address}`));
    assert.equal(new URL(whatsappUrl(text)).searchParams.get('text'), text);
  }
});

test('invalid addresses and non-web protocols are not shared as game links', () => {
  for (const address of ['file:///game/index.html', 'javascript:alert(1)', 'invalid']) {
    assert.equal(gameUrl(address), '');
  }
});
