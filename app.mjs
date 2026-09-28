import { createQuestion, levelFor, pointsFor, timeLimitFor, evaluateAnswer, shareText, whatsappUrl, readChallenge } from './game.mjs?v=4';
import { createAnalytics } from './analytics.mjs?v=1';
import { analyticsConfig } from './analytics-config.mjs?v=1';

const $ = id => document.getElementById(id);
const format = number => new Intl.NumberFormat('kk-KZ').format(number);
let best = 0;
const bestKey = '123-best-timed-v1';
try { best = Math.max(0, Number(localStorage.getItem(bestKey)) || 0); } catch {}
$('best').textContent = format(best);
let score = 0, correct = 0, question, questionLevel, startedAt, running = false, locked = false;
let frame, nextTimeout;
let preparing = false;
const challenge = readChallenge(location.href);
const analytics = createAnalytics(analyticsConfig);
let roundId, roundStartedAt;
analytics.track('page_view', { challenge: Boolean(challenge) });
const answerButtons = [...document.querySelectorAll('[data-answer]')];
try { $('player-name').value = (localStorage.getItem('123-player-name') || '').slice(0, 32); } catch {}

function refreshChallenge() {
  $('challenge').hidden = !challenge;
  if (!challenge) return;
  $('challenge-title').textContent = `${challenge.name}: ${format(challenge.score)} ұпай`;
  $('challenge-progress').textContent = score > challenge.score
    ? `Озып кеттің! +${format(score - challenge.score)} ұпай`
    : `Озып кету үшін тағы ${format(challenge.score - score + 1)} ұпай жина!`;
  $('challenge').classList.toggle('beaten', score > challenge.score);
}
refreshChallenge();

function updateShare() {
  const address = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const text = shareText({ name: $('player-name').value, score, correct, level: questionLevel, address });
  $('share-preview').value = text;
  $('share-whatsapp').href = whatsappUrl(text);
}

$('player-name').addEventListener('input', () => {
  try { localStorage.setItem('123-player-name', $('player-name').value); } catch {}
  if (!$('finished').hidden) updateShare();
});
$('player-name').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !running && !$('welcome').hidden) start();
});

function refreshStats() {
  refreshChallenge();
  $('score').textContent = format(score);
  $('level').textContent = String(levelFor(correct)).padStart(2, '0');
  $('progress-text').textContent = `Келесі деңгейге дейін: ${3 - correct % 3} дұрыс жауап`;
  document.querySelectorAll('.steps i').forEach((step, i) => step.classList.toggle('active', i < correct % 3));
}

function tick() {
  if (!running || locked) return;
  const elapsed = performance.now() - startedAt;
  const limit = timeLimitFor(questionLevel);
  if (elapsed >= limit) { finish('timeout'); return; }
  const urgent = elapsed >= limit * 0.65;
  $('timer').textContent = `${((limit - elapsed) / 1000).toFixed(1).replace('.', ',')} с`;
  $('timer').classList.toggle('urgent', urgent);
  $('timer-panel').classList.toggle('urgent', urgent);
  $('timer-label').textContent = urgent ? 'УАҚЫТ АЗ!' : 'ҚАЛҒАН УАҚЫТ';
  $('reward').textContent = `+${format(pointsFor(elapsed, questionLevel))}`;
  $('speed-fill').style.width = `${(1 - elapsed / limit) * 100}%`;
  $('speed-fill').classList.toggle('urgent', urgent);
  frame = requestAnimationFrame(tick);
}

function nextQuestion() {
  questionLevel = levelFor(correct);
  question = createQuestion(correct);
  $('question').replaceChildren();
  question.numbers.forEach((number, i) => {
    const term = document.createElement('span');
    term.textContent = i ? `${question.operators[i - 1]} ${number}` : number;
    $('question').append(term);
  });
  const equals = document.createElement('span');
  equals.textContent = '= ?';
  equals.className = 'equals';
  $('question').append(equals);
  $('question').classList.toggle('long', question.numbers.length > 4);
  $('question').scrollTop = 0;
  locked = false;
  answerButtons.forEach(button => button.disabled = false);
  startedAt = performance.now();
  tick();
}

function start() {
  if (running || preparing) return;
  roundId = globalThis.crypto?.randomUUID?.();
  analytics.track('start_clicked', { round_id: roundId, challenge: Boolean(challenge) });
  clearTimeout(nextTimeout);
  cancelAnimationFrame(frame);
  score = 0; correct = 0; running = false; preparing = true; locked = true;
  $('welcome').hidden = true;
  $('finished').hidden = true;
  $('playing').hidden = true;
  $('countdown').hidden = false;
  document.body.classList.add('in-game');
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('player-panel').hidden = true;
  $('player-name').blur();
  $('feedback').className = 'feedback';
  $('feedback').textContent = 'Жауапты таңда: 1, 2 немесе 3';
  refreshStats();
  let remaining = 3;
  $('countdown-number').textContent = String(remaining);
  const count = () => {
    if (document.hidden) {
      remaining = 3;
    } else {
      remaining--;
    }
    if (remaining === 0) {
      preparing = false;
      running = true;
      roundStartedAt = performance.now();
      analytics.track('game_started', { round_id: roundId, challenge: Boolean(challenge) });
      $('countdown').hidden = true;
      $('playing').hidden = false;
      nextQuestion();
      return;
    }
    $('countdown-number').textContent = String(remaining);
    nextTimeout = setTimeout(count, 1000);
  };
  nextTimeout = setTimeout(count, 1000);
}

function finish(reason) {
  if (!running) return;
  analytics.track('game_finished', {
    round_id: roundId, score, correct, level: questionLevel, reason,
    duration_ms: performance.now() - roundStartedAt,
    challenge: Boolean(challenge), challenge_beaten: Boolean(challenge && score > challenge.score),
  });
  running = false;
  preparing = false;
  document.body.classList.remove('in-game');
  locked = true;
  cancelAnimationFrame(frame);
  clearTimeout(nextTimeout);
  answerButtons.forEach(button => button.disabled = true);
  $('playing').hidden = true;
  $('finished').hidden = false;
  $('player-panel').hidden = false;
  $('final-score').textContent = format(score);
  $('finish-title').textContent = reason === 'timeout' ? 'Уақыт бітті.' : 'Ойын аяқталды.';
  $('summary').textContent = `${reason === 'timeout' ? 'Жауап беріп үлгермедің.' : 'Жауабың қате болды.'} Дұрыс жауап саны: ${correct} · Деңгей: ${questionLevel}. Соңғы есептің жауабы: ${question.answer}.`;
  updateShare();
  $('feedback').className = 'feedback';
  $('feedback').textContent = score > 0 && score >= best ? 'Бұл — сенің үздік нәтижең. Жарайсың!' : 'Әр талпыныс шапшаңдығыңды арттырады';
  $('restart').focus({preventScroll:true});
}

function answer(value) {
  if (!running || locked) return;
  const result = evaluateAnswer(question, value, performance.now() - startedAt, questionLevel);
  if (result.outcome !== 'correct') { finish(result.outcome); return; }
  locked = true;
  cancelAnimationFrame(frame);
  answerButtons.forEach(button => button.disabled = true);
  const points = result.points;
  score += points;
  correct++;
  $('feedback').className = 'feedback correct';
  $('feedback').textContent = `Дұрыс! +${format(points)}${correct % 3 === 0 ? ' · Жаңа деңгей!' : ''}`;
  if (score > best) {
    best = score;
    $('best').textContent = format(best);
    try { localStorage.setItem(bestKey, String(best)); } catch {}
  }
  refreshStats();
  nextTimeout = setTimeout(nextQuestion, 550);
}

$('start').addEventListener('click', start);
$('restart').addEventListener('click', start);
$('share-whatsapp').addEventListener('click', () => {
  if (!$('finished').hidden) analytics.track('share_clicked', { round_id: roundId, score, level: questionLevel });
});
answerButtons.forEach(button => button.addEventListener('click', () => answer(Number(button.dataset.answer))));
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLElement && (event.target.matches('input, textarea') || event.target.isContentEditable)) return;
  if (!event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && ['1', '2', '3'].includes(event.key)) answer(Number(event.key));
});
