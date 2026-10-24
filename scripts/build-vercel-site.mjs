import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const marker = '.ywi-vercel-static-build';

// Publish only customer-facing static assets; never publish repository internals.
const files = [
  'index.html',
  'help.html',
  'app.js',
  'style.css',
  'it-readiness.css',
  'favicon.ico',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'server-worker.js',
];
const directories = ['js', 'icons'];

if (existsSync(output)) {
  if (!existsSync(join(output, marker))) {
    throw new Error('Refusing to replace dist/: it was not created by the YW Vercel static build');
  }
  rmSync(output, { recursive: true });
}

mkdirSync(output, { recursive: true });
for (const path of files) cpSync(join(root, path), join(output, path));
for (const path of directories) cpSync(join(root, path), join(output, path), { recursive: true });

// public/data contains explicitly public, versioned website data.
const publicDirectory = join(root, 'public');
if (existsSync(publicDirectory)) {
  for (const entry of readdirSync(publicDirectory)) {
    cpSync(join(publicDirectory, entry), join(output, entry), { recursive: true });
  }
}

writeFileSync(join(output, marker), 'Generated website output. Do not edit this directory.\n');
console.log(`YW Vercel static website generated in ${output}`);
