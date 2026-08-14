/**
 * One-off image preparation.
 *
 * Takes the phone originals in resources/fotos/ and produces web-ready sources
 * in src/assets/photos/, which astro:assets then turns into responsive
 * AVIF/WebP sets at build time.
 *
 * Three things matter here beyond resizing:
 *
 *  1. EXIF is stripped. Phone photos carry GPS coordinates — publishing the
 *     couple's home location on a public website would be a real privacy leak.
 *     sharp drops metadata by default; we call .rotate() first so the
 *     orientation flag is baked into the pixels before it is discarded.
 *  2. The venue screenshots are PNGs of photographic content, which is sharp's
 *     worst case. They become JPEG sources.
 *  3. PXL_20260721_103009866.MP.jpg is a Pixel Motion Photo with an embedded
 *     video; re-encoding through sharp discards it.
 *
 * Run: node scripts/prep-photos.mjs
 */

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = [
  { from: 'resources/fotos/mara-terry', to: 'src/assets/photos/couple', prefix: 'couple' },
  { from: 'resources/fotos/location', to: 'src/assets/photos/venue', prefix: 'venue' },
];

/** Nothing is served larger than this; the hero is the only full-bleed use. */
const MAX_EDGE = 2400;
const QUALITY = 82;

/**
 * Output names are derived from the source filename, NOT from its position in
 * the folder. Sequential names (couple-01, couple-02…) look tidier but are a
 * trap: dropping one new photo into the folder renumbers everything after it
 * and silently repoints every reference in src/data/photos.ts at the wrong
 * image. Deriving the name from the source makes adding a photo additive.
 */
function stableName(prefix, file) {
  const base = file
    .replace(/\.(jpe?g|png)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^(pxl|img|screenshot)-/, '')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${base}.jpg`;
}

async function prepare({ from, to, prefix }) {
  const srcDir = path.join(root, from);
  const outDir = path.join(root, to);
  // Wipe the output folder so a renamed or removed source cannot leave a stale
  // file behind that still resolves in an import.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(srcDir))
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort();

  const results = [];
  for (const file of files) {
    const name = stableName(prefix, file);
    const outPath = path.join(outDir, name);

    const info = await sharp(path.join(srcDir, file))
      .rotate() // bake in EXIF orientation before metadata is dropped
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(outPath);

    results.push({ source: file, name, width: info.width, height: info.height, bytes: info.size });
    console.log(
      `${file.padEnd(34)} → ${name.padEnd(34)} ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`,
    );
  }
  return { outDir, prefix, results };
}

/**
 * A single contact sheet per folder, so the whole set can be reviewed in one
 * look instead of opening thirteen multi-megabyte files.
 */
async function contactSheet({ outDir, prefix, results }, cols) {
  const CELL_W = 420;
  const CELL_H = 315;
  const rows = Math.ceil(results.length / cols);

  const tiles = await Promise.all(
    results.map(async (r, i) =>
      sharp(path.join(outDir, r.name))
        .resize(CELL_W, CELL_H, { fit: 'cover' })
        .toBuffer()
        .then((input) => ({
          input,
          left: (i % cols) * CELL_W,
          top: Math.floor(i / cols) * CELL_H,
        })),
    ),
  );

  const labels = results
    .map((r, i) => {
      const x = (i % cols) * CELL_W + 10;
      const y = Math.floor(i / cols) * CELL_H + 28;
      const label = r.name.replace('.jpg', '').replace(/^(couple|venue)-/, '');
      return `<rect x="${x - 6}" y="${y - 22}" width="${label.length * 11 + 16}" height="30" rx="6" fill="rgba(0,0,0,0.66)"/>
              <text x="${x}" y="${y}" font-family="monospace" font-size="19" fill="#fff">${label}</text>`;
    })
    .join('');

  const sheetPath = path.join(root, 'scratch', `contact-${prefix}.jpg`);
  await mkdir(path.dirname(sheetPath), { recursive: true });

  await sharp({
    create: {
      width: cols * CELL_W,
      height: rows * CELL_H,
      channels: 3,
      background: { r: 247, g: 243, b: 237 },
    },
  })
    .composite([
      ...tiles,
      {
        input: Buffer.from(
          `<svg width="${cols * CELL_W}" height="${rows * CELL_H}">${labels}</svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 72 })
    .toFile(sheetPath);

  console.log(`contact sheet → ${path.relative(root, sheetPath)}`);
}

const manifest = {};
for (const source of SOURCES) {
  const prepared = await prepare(source);
  await contactSheet(prepared, source.prefix === 'couple' ? 5 : 3);
  manifest[source.prefix] = prepared.results;
}

await writeFile(
  path.join(root, 'scratch', 'photo-manifest.json'),
  JSON.stringify(manifest, null, 2),
);
console.log('\nDone.');
