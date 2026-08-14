/**
 * Screenshot helper for reviewing the site during development.
 *
 * Usage:
 *   node scripts/shot.mjs                       # home page, mobile + desktop
 *   node scripts/shot.mjs /schedule /travel     # specific pages
 *   node scripts/shot.mjs --full /questions     # full-page rather than viewport
 *
 * Assumes the dev server is already running on :4321.
 */

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'scratch', 'shots');
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4321';

const args = process.argv.slice(2);
const fullPage = args.includes('--full');
const paths = args.filter((a) => !a.startsWith('--'));
const targets = paths.length ? paths : ['/'];

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });

  const consoleErrors = [];
  page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()));
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  for (const target of targets) {
    const url = `${BASE}${target}`;
    const response = await page.goto(url, { waitUntil: 'networkidle' });

    // Scroll the whole page so lazily-loaded images below the fold actually
    // decode before the screenshot; otherwise they capture as empty boxes.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      // `behavior: instant` matters: global `scroll-behavior: smooth` would
      // otherwise still be animating when the screenshot is taken, capturing
      // the page mid-scroll.
      window.scrollTo({ top: 0, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 150));
      await Promise.all(
        [...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {})),
      );
    });
    await page.waitForLoadState('networkidle');
    const slug = target === '/' ? 'home' : target.replace(/^\/|\/$/g, '').replace(/\//g, '-');
    const file = path.join(outDir, `${slug}-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage });

    const status = response?.status() ?? 0;
    console.log(
      `${status === 200 ? 'ok  ' : `HTTP ${status}`} ${viewport.name.padEnd(8)} ${target.padEnd(16)} → ${path.relative(root, file)}`,
    );

    // A horizontal scrollbar on a phone is the single most common mobile bug.
    if (viewport.name === 'mobile') {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 0) console.warn(`  ⚠ horizontal overflow of ${overflow}px on ${target}`);
    }
  }

  if (consoleErrors.length) {
    console.warn(`  ⚠ console errors (${viewport.name}):`);
    for (const e of [...new Set(consoleErrors)]) console.warn(`    ${e}`);
  }

  await page.close();
}

await browser.close();
