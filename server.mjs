import http from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/game.mjs', ['game.mjs', 'text/javascript; charset=utf-8']],
  ['/analytics.mjs', ['analytics.mjs', 'text/javascript; charset=utf-8']],
  ['/analytics-config.mjs', ['analytics-config.mjs', 'text/javascript; charset=utf-8']],
]);
const server = http.createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = files.get(path);
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
    response.end(body);
  } catch { response.writeHead(500); response.end('Unable to load file'); }
});
const port = Number(process.env.PORT) || 3213;
server.listen(port, '0.0.0.0', () => console.log(`Game: http://localhost:${port}`));
