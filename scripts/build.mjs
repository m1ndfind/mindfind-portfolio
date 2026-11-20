import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const staging = resolve(root, '.dist-build');
await rm(staging, { recursive: true, force: true });
await mkdir(staging);
await cp(join(root, 'public'), staging, { recursive: true });
await cp(join(root, 'src'), staging, { recursive: true });
await rm(output, { recursive: true, force: true });
await rename(staging, output);
console.log('Static site built in dist/');
