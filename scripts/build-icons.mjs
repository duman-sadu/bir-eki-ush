import { readFile, mkdir } from 'node:fs/promises';
import { launchBrowser } from './browser.mjs';

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const svg = await readFile(new URL('../icons/icon.svg', import.meta.url), 'utf8');
  await mkdir(new URL('../icons/', import.meta.url), { recursive: true });
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: new URL(`../icons/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
  }
  console.log('Generated 192px, 512px and 180px app icons.');
} finally { await browser.close(); }
