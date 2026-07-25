import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const client = resolve(dist, 'client');
const server = resolve(dist, 'server');

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });

for (const directory of ['assets', 'src', 'vendor']) {
  await cp(resolve(root, directory), resolve(client, directory), { recursive: true });
}
await cp(resolve(root, 'index.html'), resolve(client, 'index.html'));

await writeFile(resolve(server, 'index.js'), `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`);

console.log('Hosted game build created in dist/');
