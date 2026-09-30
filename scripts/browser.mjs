import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

export function launchBrowser() {
  const executablePath = [process.env.BROWSER_EXECUTABLE,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome',
  ].find(path => path && existsSync(path));
  if (!executablePath) throw new Error('Set BROWSER_EXECUTABLE to an installed Chromium browser.');
  return chromium.launch({ executablePath, headless: true });
}
