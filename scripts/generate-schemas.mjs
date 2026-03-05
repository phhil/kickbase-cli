import { mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src', 'schemas', 'tools');
const dist = join(root, 'dist', 'schemas', 'tools');

mkdirSync(dist, { recursive: true });

for (const file of readdirSync(src)) {
  if (!file.endsWith('.json')) continue;
  copyFileSync(join(src, file), join(dist, file));
}

console.log(`Generated tool schemas in ${dist}`);
