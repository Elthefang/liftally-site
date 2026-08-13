import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const sourceDir = root;
const outputDir = join(root, 'dist', 'production');
const ignoredNames = new Set([
  '.git',
  '.firebase',
  '.firebaserc',
  '.DS_Store',
  'dist',
  'firebase-debug.log',
  'firebase.json',
  'firebase.production.json',
  'firestore.indexes.json',
  'firestore.rules'
]);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
  if (
    ignoredNames.has(entry.name)
    || entry.name === 'firebase.production.json'
    || entry.name === 'scripts'
    || entry.name.endsWith('.md')
  ) continue;
  await cp(join(sourceDir, entry.name), join(outputDir, entry.name), { recursive: true });
}

await rm(join(outputDir, 'firebase/firebase-config.staging.js'), { force: true });
await rm(join(outputDir, 'firebase/liftally-staging-backend.js'), { force: true });
await rm(join(outputDir, 'firebase/staging-smoke-test.js'), { force: true });
await rm(join(outputDir, 'firebase-staging-test.html'), { force: true });
for (const entry of await readdir(join(outputDir, 'firebase'), { withFileTypes: true })) {
  if (entry.name.endsWith('.md')) {
    await rm(join(outputDir, 'firebase', entry.name), { recursive: true, force: true });
  }
}

const htmlFiles = (await import('node:fs')).readdirSync(outputDir)
  .filter((file) => file.endsWith('.html'));

for (const file of htmlFiles) {
  const path = join(outputDir, file);
  const source = await readFile(path, 'utf8');
  const productionHtml = source
    .replaceAll('firebase/firebase-config.staging.js', 'firebase/firebase-config.production.js')
    .replaceAll('firebase/liftally-staging-backend.js', 'firebase/liftally-production-backend.js');
  await writeFile(path, productionHtml);
}

const productionConfig = await readFile(join(outputDir, 'firebase/firebase-config.production.js'), 'utf8');
const configBlock = productionConfig.match(/const firebaseConfig = \{([\s\S]*?)\n  \};/);
if (!configBlock || configBlock[1].includes('__PRODUCTION_')) {
  throw new Error('Production Web App config is incomplete. Run firebase apps:sdkconfig WEB first.');
}

console.log(`Built production site at ${outputDir}`);
