/**
 * Bundle the Apps Script backend into a single gas/dist/Code.gs.
 *
 * Apps Script has no module system, so everything is flattened into one IIFE
 * and the four entry points are re-exposed as top-level functions — Google
 * looks those up by name.
 *
 * The point of bundling rather than hand-writing .gs files is that the backend
 * imports src/lib/rsvp/validate.ts directly. The browser form and the server
 * therefore run byte-for-byte the same validation, and it is impossible for one
 * to accept something the other rejects.
 *
 * Run: npm run build:gas
 */

import { build } from 'esbuild';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'gas', 'dist', 'Code.gs');

await mkdir(path.dirname(outfile), { recursive: true });

await build({
  entryPoints: [path.join(root, 'gas', 'src', 'main.ts')],
  outfile,
  bundle: true,
  format: 'iife',
  globalName: '__wedding',
  // Apps Script's V8 runtime is modern, but not bleeding edge.
  target: 'es2019',
  platform: 'neutral',
  charset: 'utf8',
  legalComments: 'none',
  banner: {
    js: [
      '// GENERATED FILE — do not edit here.',
      '// Built from gas/src/*.ts by scripts/build-gas.mjs.',
      '// Edit the TypeScript and re-run `npm run build:gas`.',
      '',
    ].join('\n'),
  },
});

// Apps Script calls these by name at the top level; the bundle only exposes
// them as properties of the IIFE's global object.
await appendFile(
  outfile,
  [
    '',
    'function doGet(e) { return __wedding.doGet(e); }',
    'function doPost(e) { return __wedding.doPost(e); }',
    'function onOpen() { return __wedding.onOpen(); }',
    'function rebuildExports() { return __wedding.rebuildExports(); }',
    '',
  ].join('\n'),
);

console.log(`Built ${path.relative(root, outfile)}`);
console.log('Push it with `clasp push` from gas/, or paste it into the Apps Script editor.');
