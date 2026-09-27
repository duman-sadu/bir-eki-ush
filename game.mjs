export function levelFor(correct) {
  return Math.floor(correct / 3) + 1;
}

export function timeLimitFor(level) {
  return 8000 / (1 + (level - 1) * 0.12);
}

export function pointsFor(milliseconds, level = 1) {
  const remaining = 1 - Math.max(0, milliseconds) / timeLimitFor(level);
  if (remaining <= 0) return 0;
  return Math.round(100 * level * level * (1 + 0.5 * remaining));
}

export function evaluateAnswer(question, value, elapsed, level) {
  if (elapsed >= timeLimitFor(level)) return { outcome: 'timeout', points: 0 };
  if (value !== question.answer) return { outcome: 'wrong', points: 0 };
  return { outcome: 'correct', points: pointsFor(elapsed, level) };
}

export function normalizeName(name) {
  return String(name).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32) || 'Ойыншы';
}

export function gameUrl(address) {
  try {
    const url = new URL(address);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.origin + url.pathname;
  } catch { return ''; }
}

export function shareText({ name, score, correct, level, address }) {
  const format = number => new Intl.NumberFormat('kk-KZ').format(number);
  const lines = [
    '🧠 1+2=3 — жылдам есептеу ойыны',
    `Ойыншы: ${normalizeName(name)}`,
    `🏆 Ұпай: ${format(score)}`,
    `Деңгей: ${level} · Дұрыс жауап: ${correct}`,
    'Менің ұпайымнан асып көр! 💪',
  ];
  const link = gameUrl(address);
  if (link) lines.push(`Ойна: ${link}`);
  return lines.join('\n');
}

export function whatsappUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function createQuestion(correct, random = Math.random) {
  const pick = (max) => Math.floor(random() * max);
  const terms = levelFor(correct) + 1;
  let value = pick(3) + 1;
  const numbers = [value];
  const operators = [];
  for (let i = 1; i < terms; i++) {
    const candidates = Array.from({ length: i === terms - 1 ? 3 : 6 }, (_, j) => j + 1)
      .filter(next => next !== value && Math.abs(next - value) <= 3);
    const next = candidates[pick(candidates.length)];
    operators.push(next > value ? '+' : '−');
    numbers.push(Math.abs(next - value));
    value = next;
  }
  return { numbers, operators, answer: value };
}
