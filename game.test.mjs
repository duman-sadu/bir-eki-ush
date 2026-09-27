import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuestion, levelFor, pointsFor, timeLimitFor, evaluateAnswer } from './game.mjs';

test('difficulty increases after each three correct answers', () => {
  assert.deepEqual([0,1,2,3,4,5,6].map(levelFor), [1,1,1,2,2,2,3]);
});

test('generated expressions evaluate to an available answer at every tested level', () => {
  let seed = 123;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const answers = new Set();
  for (let correct = 0; correct < 150; correct++) {
    for (let i = 0; i < 30; i++) {
      const question = createQuestion(correct, random);
      assert.equal(question.numbers.length, Math.floor(correct / 3) + 2);
      assert.equal(question.operators.length, question.numbers.length - 1);
      const value = question.numbers.reduce((sum, n, index) => index === 0 ? n : question.operators[index - 1] === '+' ? sum + n : sum - n, 0);
      assert.equal(value, question.answer);
      assert.ok([1,2,3].includes(value));
      assert.ok(question.numbers.every(n => [1, 2, 3].includes(n)));
      answers.add(value);
    }
  }
  assert.equal(answers.size, 3);
});

test('operand restriction holds at both extremes of random selection', () => {
  for (const random of [() => 0, () => 0.999999]) {
    for (let correct = 0; correct < 150; correct++) {
      const question = createQuestion(correct, random);
      assert.ok(question.numbers.every(n => [1, 2, 3].includes(n)));
      const result = question.numbers.reduce((sum, n, i) => i === 0 ? n : question.operators[i - 1] === '+' ? sum + n : sum - n, 0);
      assert.equal(result, question.answer);
      assert.ok([1, 2, 3].includes(result));
    }
  }
});

test('higher levels keep increasing difficulty and rewards while reducing time', () => {
  assert.equal(timeLimitFor(1), 8000);
  for (let level = 1; level < 1000; level++) {
    assert.ok(timeLimitFor(level + 1) < timeLimitFor(level));
    assert.ok(timeLimitFor(level + 1) > 0);
    assert.ok(pointsFor(0, level + 1) > pointsFor(0, level));
    assert.ok(pointsFor(timeLimitFor(level + 1) / 2, level + 1) > pointsFor(timeLimitFor(level) / 2, level));
  }
  assert.equal(createQuestion(3000).numbers.length, 1002);
  assert.ok(pointsFor(timeLimitFor(5) - 1, 5) > pointsFor(0, 1));
});

test('speed adds a bonus within the level and expired answers earn nothing', () => {
  for (const level of [1, 2, 5, 10, 100]) {
    const limit = timeLimitFor(level);
    assert.equal(pointsFor(0, level), 150 * level * level);
    assert.equal(pointsFor(limit / 2, level), 125 * level * level);
    assert.ok(pointsFor(limit - 1, level) >= 100 * level * level);
    assert.equal(pointsFor(limit, level), 0);
    assert.equal(pointsFor(limit + 1000, level), 0);
    assert.equal(pointsFor(-100, level), pointsFor(0, level));
  }
});

test('deadline takes precedence even when the correct answer arrives before the next timer frame', () => {
  const question = { answer: 3 };
  for (const level of [1, 5, 100]) {
    const limit = timeLimitFor(level);
    assert.equal(evaluateAnswer(question, 3, limit - 1, level).outcome, 'correct');
    assert.deepEqual(evaluateAnswer(question, 3, limit, level), { outcome: 'timeout', points: 0 });
    assert.deepEqual(evaluateAnswer(question, 3, limit + 10000, level), { outcome: 'timeout', points: 0 });
    assert.deepEqual(evaluateAnswer(question, 1, 100, level), { outcome: 'wrong', points: 0 });
  }
});
