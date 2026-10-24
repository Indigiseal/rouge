// npm test: every test:* and audit:* script in package.json, one after another.
// The browser tests load the game from the dev server, so this starts one on
// 4173 when nothing answers there yet, and stops it at the end.
// Playwright must be reachable through NODE_PATH for the browser tests.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:4173';
const scripts = Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).scripts)
    .filter(name => name.startsWith('test:') || name.startsWith('audit:'));

async function serverUp() {
    try { await fetch(BASE); return true; } catch { return false; }
}

let server = null;
if (!(await serverUp())) {
    server = spawn(process.execPath, ['tools/server.mjs'], { stdio: 'ignore' });
    for (let i = 0; i < 50 && !(await serverUp()); i++) await new Promise(r => setTimeout(r, 100));
}

const failed = [];
for (const name of scripts) {
    const started = Date.now();
    const run = spawnSync('npm', ['run', '-s', name], { encoding: 'utf8', shell: process.platform === 'win32' });
    const ok = run.status === 0;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    if (!ok) {
        failed.push(name);
        // The last lines usually hold the assertion that failed.
        const tail = `${run.stdout}${run.stderr}`.trim().split('\n').filter(l => !/^\s+at /.test(l)).slice(-8);
        console.log(tail.map(l => '      ' + l).join('\n'));
    }
}

server?.kill();
console.log(`\n${scripts.length - failed.length}/${scripts.length} passed${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
