import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import purchasesHandler from '../api/purchases.js';
import stateHandler from '../api/state.js';

const port = Number(process.env.PORT || 4300);
const root = normalize(join(process.cwd(), 'dist'));
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function serveFile(res, filePath) {
  res.statusCode = 200;
  res.setHeader('Content-Type', mimeTypes[extname(filePath)] || 'application/octet-stream');
  createReadStream(filePath).pipe(res);
}

function startIndexer() {
  const indexerPath = join(__dirname, 'indexer.js');
  const child = spawn(process.execPath, [indexerPath], {
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit']
  });
  child.on('exit', (code, signal) => {
    console.log(`[indexer] exited code=${code} signal=${signal} — restarting in 2s`);
    setTimeout(startIndexer, 2000);
  });
  child.on('error', err => {
    console.error('[indexer] spawn error:', err.message);
  });
  console.log(`[indexer] started pid=${child.pid}`);
}

startIndexer();

createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`);

  if (url.pathname === '/api/state') {
    stateHandler(req, res);
    return;
  }

  if (url.pathname === '/api/purchases') {
    purchasesHandler(req, res);
    return;
  }

  const requested = normalize(join(root, url.pathname === '/' ? 'index.html' : url.pathname));
  const filePath = requested.startsWith(root) && existsSync(requested) ? requested : join(root, 'index.html');
  serveFile(res, filePath);
}).listen(port, () => {
  console.log(`GLITCH live preview: http://localhost:${port}`);
});
