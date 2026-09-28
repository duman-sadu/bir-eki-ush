import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as game from './game.mjs';

function browser(address = 'https://example.com/') {
  let now = 0, nextId = 0;
  const timers = new Map();
  class Element {
    constructor() {
      this.hidden = false;
      this.value = '';
      this.textContent = '';
      this.dataset = {};
      this.style = {};
      this.events = {};
      this.children = [];
      const classes = new Set();
      this.classList = {
        add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
      };
    }
    addEventListener(name, fn) { this.events[name] = fn; }
    append(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    focus() {}
    blur() {}
  }
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  for (const id of ['playing', 'finished', 'countdown']) get(id).hidden = true;
  const buttons = [1, 2, 3].map(n => { const b = new Element(); b.dataset.answer = String(n); return b; });
  const document = {
    hidden: false, body: new Element(), getElementById: get,
    querySelector: () => ({ href: 'https://example.com/' }),
    querySelectorAll: selector => selector === '[data-answer]' ? buttons : [new Element(), new Element(), new Element()],
    createElement: () => new Element(), addEventListener() {},
  };
  const context = vm.createContext({
    ...game, document, location: { href: address }, HTMLElement: Element,
    window: { scrollTo() {} }, localStorage: { getItem() { return null; }, setItem() {} },
    performance: { now: () => now },
    requestAnimationFrame: () => ++nextId, cancelAnimationFrame() {},
    setTimeout: (fn, delay) => { const id = ++nextId; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const source = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
  vm.runInContext(source, context);
  return {
    get, document, run: code => vm.runInContext(code, context),
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
  };
}

test('countdown blocks answers, starts a full timer, and resets on replay', () => {
  const ui = browser();
  ui.get('start').events.click();
  assert.equal(ui.get('countdown-number').textContent, '3');
  assert.ok(ui.document.body.classList.contains('in-game'));
  ui.run('answer(1); start()');
  ui.advance(1000);
  assert.equal(ui.get('countdown-number').textContent, '2');
  ui.advance(1000);
  assert.equal(ui.get('countdown-number').textContent, '1');
  assert.equal(ui.get('playing').hidden, true);
  ui.advance(1000);
  assert.equal(ui.get('playing').hidden, false);
  assert.equal(ui.get('countdown').hidden, true);
  assert.equal(ui.get('timer').textContent, '8,0 с');
  assert.equal(ui.run('score'), 0);
  ui.advance(5200);
  ui.run('tick()');
  assert.ok(ui.get('timer-panel').classList.contains('urgent'));
  ui.advance(2800);
  ui.run('tick()');
  assert.equal(ui.get('finished').hidden, false);
  assert.equal(ui.document.body.classList.contains('in-game'), false);
  ui.get('restart').events.click();
  assert.equal(ui.get('countdown-number').textContent, '3');
  ui.advance(3000);
  assert.equal(ui.get('timer').textContent, '8,0 с');
  assert.equal(ui.get('timer-panel').classList.contains('urgent'), false);
});

test('friend challenge tracks the score and sharing replaces the incoming result', () => {
  const ui = browser(game.challengeUrl('https://example.com/', 'Әлия <b>', 100));
  assert.equal(ui.get('challenge-title').textContent, 'Әлия <b>: 100 ұпай');
  assert.ok(ui.get('challenge-progress').textContent.includes('101'));
  ui.get('start').events.click();
  ui.advance(3000);
  ui.run('answer(question.answer)');
  assert.equal(ui.run('score'), 150);
  assert.ok(ui.get('challenge').classList.contains('beaten'));
  ui.advance(550);
  ui.run('answer(question.answer === 1 ? 2 : 1)');
  ui.get('player-name').value = 'Бекзат';
  ui.get('player-name').events.input();
  const text = new URL(ui.get('share-whatsapp').href).searchParams.get('text');
  assert.deepEqual(game.readChallenge(text.split('Ойна: ')[1]), { name: 'Бекзат', score: 150 });
  ui.get('restart').events.click();
  assert.equal(ui.get('challenge').classList.contains('beaten'), false);
});

test('preparation does not start a question in a hidden tab', () => {
  const ui = browser();
  ui.get('start').events.click();
  ui.document.hidden = true;
  ui.advance(5000);
  assert.equal(ui.get('countdown-number').textContent, '3');
  assert.equal(ui.get('playing').hidden, true);
  ui.document.hidden = false;
  ui.advance(3000);
  assert.equal(ui.get('timer').textContent, '8,0 с');
});
