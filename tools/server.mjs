// tools/server.mjs
//
// Lightweight dev server for the rouge-github project. Serves the repo root
// over HTTP with `Cache-Control: no-store` so every refresh fetches the
// freshest asset — no more stale textures after you swap a PNG.
//
//   node tools/server.mjs                   → port 4173 (default)
//   node tools/server.mjs --port 5173       → custom port
//
// Stops with Ctrl+C.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

// --port N argument (defaults to 4173)
let port = 4173;
const portIdx = process.argv.indexOf('--port');
if (portIdx !== -1 && process.argv[portIdx + 1]) {
    const n = parseInt(process.argv[portIdx + 1], 10);
    if (Number.isFinite(n) && n > 0) port = n;
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.mjs':  'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.wav':  'audio/wav',
    '.mp3':  'audio/mpeg',
    '.ogg':  'audio/ogg',
    '.ttf':  'font/ttf',
    '.otf':  'font/otf',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.xml':  'application/xml',
    '.txt':  'text/plain; charset=utf-8',
};

const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':        'no-cache',
    'Expires':       '0',
};

const server = createServer(async (req, res) => {
    try {
        const url = decodeURIComponent(req.url.split('?')[0]);
        let rel = url === '/' ? '/index.html' : url;
        // path traversal guard
        const target = resolve(join(ROOT, rel));
        if (!target.startsWith(ROOT + sep) && target !== ROOT) {
            res.writeHead(403, noCacheHeaders); res.end('forbidden'); return;
        }

        let info;
        try { info = await stat(target); }
        catch { res.writeHead(404, noCacheHeaders); res.end('not found'); return; }

        // If directory, append index.html
        const path = info.isDirectory() ? join(target, 'index.html') : target;
        const body = await readFile(path);
        const ext = extname(path).toLowerCase();
        const headers = {
            ...noCacheHeaders,
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Content-Length': body.length,
        };
        res.writeHead(200, headers);
        res.end(body);
    } catch (err) {
        res.writeHead(500, noCacheHeaders);
        res.end('server error: ' + err.message);
    }
});

server.listen(port, () => {
    console.log(`dev server  http://localhost:${port}`);
    console.log(`serving     ${ROOT}`);
    console.log('Cache-Control: no-store on every response — refresh and assets reload fresh.');
    console.log('Ctrl+C to stop.');
});
