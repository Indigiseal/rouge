// tools/server.mjs
//
// Lightweight dev server for the rouge-github project. Serves the repo root
// over HTTP with ETag revalidation, so a refresh re-downloads exactly the files
// you edited and nothing else — no stale textures after you swap a PNG, and no
// resending the whole game every time.
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

// Errors are never cached — a 404 now may be a real file a moment from now.
const noStoreHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':        'no-cache',
    'Expires':       '0',
};

// Assets are revalidated instead of re-sent.
//
// This used to answer no-store for everything, which guaranteed fresh art but
// meant every reload re-downloaded the whole game. `no-cache` is confusingly
// named: it means "check with me before reusing this", not "do not keep it".
// The browser sends back the ETag it holds and gets a bodyless 304 whenever the
// file is unchanged. Redraw a PNG and its size/mtime move, so the ETag changes
// and the full file comes down — the same never-stale guarantee, without
// resending megabytes on every refresh.
const etagFor = (info) =>
    `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;

const server = createServer(async (req, res) => {
    try {
        const url = decodeURIComponent(req.url.split('?')[0]);
        let rel = url === '/' ? '/index.html' : url;
        // path traversal guard
        const target = resolve(join(ROOT, rel));
        if (!target.startsWith(ROOT + sep) && target !== ROOT) {
            res.writeHead(403, noStoreHeaders); res.end('forbidden'); return;
        }

        let info;
        try { info = await stat(target); }
        catch { res.writeHead(404, noStoreHeaders); res.end('not found'); return; }

        // If directory, append index.html
        const path = info.isDirectory() ? join(target, 'index.html') : target;
        // Re-stat when we stepped into a directory: the ETag has to describe the
        // file actually sent, not the folder it lives in.
        let fileInfo = info;
        if (info.isDirectory()) {
            try { fileInfo = await stat(path); }
            catch { res.writeHead(404, noStoreHeaders); res.end('not found'); return; }
        }

        const etag = etagFor(fileInfo);
        const cacheHeaders = { 'Cache-Control': 'no-cache', 'ETag': etag };

        // Unchanged since the browser last asked — answer without a body, and
        // without reading the file off disk at all.
        if (req.headers['if-none-match'] === etag) {
            res.writeHead(304, cacheHeaders);
            res.end();
            return;
        }

        const body = await readFile(path);
        const ext = extname(path).toLowerCase();
        res.writeHead(200, {
            ...cacheHeaders,
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Content-Length': body.length,
        });
        res.end(body);
    } catch (err) {
        res.writeHead(500, noStoreHeaders);
        res.end('server error: ' + err.message);
    }
});

server.listen(port, () => {
    console.log(`dev server  http://localhost:${port}`);
    console.log(`serving     ${ROOT}`);
    console.log('ETag revalidation — unchanged files answer 304, edited files resend.');
    console.log('Ctrl+C to stop.');
});
