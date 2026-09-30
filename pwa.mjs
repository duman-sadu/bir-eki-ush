const $ = id => document.getElementById(id);
let promptEvent;
let registration;
let requestedUpdate = false;
let activatedUpdate = false;
let offlineReady = false;
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function refreshStatus() {
  $('install-panel').hidden = standalone() && !registration?.waiting && !activatedUpdate && navigator.onLine;
  $('install-button').hidden = !promptEvent || standalone();
  $('install-help').hidden = standalone();
  $('offline-status').textContent = !navigator.onLine
    ? (offlineReady ? 'Интернет жоқ. Ойнай бер! WhatsApp үшін интернет қажет.' : 'Интернет жоқ. Офлайн сақтау үшін желіге қосыл.')
    : offlineReady ? 'Ойын сақталды — интернетсіз де ойнай аласың.' : 'Офлайн ойынға дайындалып жатыр…';
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  promptEvent = event;
  refreshStatus();
});
window.addEventListener('appinstalled', () => {
  promptEvent = null;
  $('install-button').hidden = true;
  $('offline-status').textContent = 'Ойын басты экранға қосылды!';
});
$('install-button').addEventListener('click', async () => {
  if (!promptEvent) return;
  const event = promptEvent;
  promptEvent = null;
  $('install-button').hidden = true;
  try { await event.prompt(); await event.userChoice; } catch {}
});

function showUpdate() {
  $('install-panel').hidden = false;
  $('update-button').hidden = false;
  $('update-status').hidden = false;
}
$('update-button').addEventListener('click', () => {
  if (document.body.classList.contains('in-game')) return;
  if (activatedUpdate) { location.reload(); return; }
  if (registration?.waiting) {
    requestedUpdate = true;
    $('update-button').disabled = true;
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  }
});
window.addEventListener('online', refreshStatus);
window.addEventListener('offline', refreshStatus);
refreshStatus();

if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (requestedUpdate) { location.reload(); return; }
    if (hadController) { activatedUpdate = true; showUpdate(); }
  });
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(async reg => {
    registration = reg;
    const watchInstalling = () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
      });
    };
    reg.addEventListener('updatefound', watchInstalling);
    watchInstalling();
    if (reg.waiting) showUpdate();
    await navigator.serviceWorker.ready;
    offlineReady = true;
    refreshStatus();
  }).catch(() => {
    $('offline-status').textContent = 'Офлайн сақтау орындалмады. Интернетпен ойнай аласың.';
  });
} else {
  $('offline-status').textContent = 'Бұл браузерде офлайн режим қолжетімсіз.';
}
