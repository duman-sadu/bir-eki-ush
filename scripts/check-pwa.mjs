import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';

let revision = 1;
const assets = new Set(['index.html', 'style.css', 'app.mjs', 'game.mjs', 'analytics.mjs', 'analytics-config.mjs',
  'pwa.mjs', 'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']);
const server = http.createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const asset = path.replace(/^\/bir-eki-ush\//, '') || 'index.html';
  if (!path.startsWith('/bir-eki-ush/') || !assets.has(asset)) { response.writeHead(404); response.end(); return; }
  try {
    let content = await readFile(new URL(`../${asset}`, import.meta.url));
    if (asset === 'sw.js') content = content.toString().replace('bir-eki-ush-shell-v1', `bir-eki-ush-shell-v${revision}`);
    const mime = asset.endsWith('.png') ? 'image/png' : asset.endsWith('.html') ? 'text/html' : asset.endsWith('.css') ? 'text/css' : asset.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/javascript';
    response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    response.end(content);
  } catch { response.writeHead(500); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/bir-eki-ush/`;
let browser;
try {
  browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}#challenge=1&name=Dos&score=100`);
  await page.waitForFunction(() => document.querySelector('#offline-status').textContent.includes('Ойын сақталды'));
  await page.evaluate(() => navigator.serviceWorker.ready);
  const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
  assert.equal(manifest.display, 'standalone');
  assert.equal(new URL(manifest.start_url, base).href, base);
  for (const icon of manifest.icons) {
    const dims = await page.evaluate(async src => { const image = new Image(); image.src = src; await image.decode(); return [image.naturalWidth, image.naturalHeight]; }, icon.src);
    assert.equal(dims.join('x'), icon.sizes);
  }
  // Installation prompt wiring, without forcing any browser/OS installation.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.installWasRequested = true; };
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
  });
  await page.locator('#install-button').click();
  assert.equal(await page.evaluate(() => window.installWasRequested), true);

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#offline-status').textContent.includes('Ойнай бер'));
  assert.ok((await page.locator('#challenge-title').textContent()).includes('Dos'));
  await page.locator('#start').click();
  await page.waitForSelector('#playing:not([hidden])');
  assert.equal(await page.locator('.intro').isVisible(), false);
  const answer = async () => page.locator('#question span:not(.equals)').evaluateAll(spans => spans.reduce((sum, span) => sum + Number(span.textContent.replace(/\s/g, '').replace('−', '-')), 0));
  await page.locator(`[data-answer="${await answer()}"]`).click();
  assert.ok(Number((await page.locator('#score').textContent()).replace(/\D/g, '')) >= 100);
  await page.waitForFunction(() => !document.querySelector('[data-answer]').disabled);
  await mkdir(new URL('../.publish/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../.publish/pwa-mobile.png', import.meta.url)), fullPage: true });
  const wrong = (await answer()) === 1 ? 2 : 1;
  await page.locator(`[data-answer="${wrong}"]`).click();
  await page.waitForSelector('#finished:not([hidden])');
  const best = await page.locator('#best').textContent();
  assert.ok(decodeURIComponent(await page.locator('#share-whatsapp').getAttribute('href')).includes('https://duman-sadu.github.io/bir-eki-ush/'));
  await page.reload();
  assert.equal(await page.locator('#best').textContent(), best);
  assert.ok((await page.locator('#offline-status').textContent()).includes('Интернет жоқ'));

  // A waiting update cannot interrupt a round and needs an explicit click.
  await context.setOffline(false);
  await page.locator('#start').click();
  await page.waitForSelector('#playing:not([hidden])');
  revision = 2;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
  assert.equal(await page.locator('#update-button').isVisible(), false);
  assert.equal(await page.locator('#playing').isVisible(), true);
  await page.locator(`[data-answer="${(await answer()) === 1 ? 2 : 1}"]`).click();
  await page.waitForSelector('#finished:not([hidden])');
  await page.locator('#update-button').click();
  await page.waitForFunction(async () => (await caches.keys()).includes('bir-eki-ush-shell-v2'));
  await page.waitForSelector('#welcome:not([hidden])');
  assert.equal(await page.locator('#best').textContent(), best);
  const keys = await page.evaluate(() => caches.keys());
  assert.ok(!keys.includes('bir-eki-ush-shell-v1'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#start');
  assert.deepEqual(errors, []);
  console.log('PASS: subpath manifest/icons, install prompt, offline reload/play, score persistence, challenge/share links, waiting update, cache cleanup, mobile width, no JS errors.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
