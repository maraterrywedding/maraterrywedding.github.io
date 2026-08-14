/**
 * Fetch thirty years of early-June weather for the venue and reduce it to a
 * handful of numbers, committed as src/data/climate-june.json.
 *
 * Run once, online: `npm run fetch:climate`
 *
 * Why at build time rather than in the browser: the wedding is far past any
 * forecast horizon, so this data never changes in a way a guest would notice.
 * Baking it in means the panel renders instantly, works with the network
 * unplugged, and cannot fail in front of anyone.
 *
 * The window is 4–18 June — a week either side of the wedding date — because a
 * single calendar day across thirty years is only thirty samples, and one
 * freak thunderstorm in 2003 would skew it.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const LAT = 52.028;
const LON = 9.415;
const TIMEZONE = 'Europe/Berlin';

const FIRST_YEAR = 1995;
const LAST_YEAR = 2025;
/** Day-of-month bounds, inclusive. The wedding is the 11th. */
const WINDOW = { from: 4, to: 18 };
/** A day "has rain" above this much accumulation, in millimetres. */
const RAIN_THRESHOLD_MM = 1;

const url =
  'https://archive-api.open-meteo.com/v1/archive?' +
  new URLSearchParams({
    latitude: String(LAT),
    longitude: String(LON),
    start_date: `${FIRST_YEAR}-06-01`,
    end_date: `${LAST_YEAR}-06-30`,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: TIMEZONE,
  });

console.log(`Fetching ${FIRST_YEAR}–${LAST_YEAR} June records for ${LAT}, ${LON}…`);

const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Open-Meteo returned ${response.status} ${response.statusText}`);
}
const raw = await response.json();

const time = raw.daily?.time ?? [];
const maxima = raw.daily?.temperature_2m_max ?? [];
const minima = raw.daily?.temperature_2m_min ?? [];
const precipitation = raw.daily?.precipitation_sum ?? [];

if (!time.length) throw new Error('No daily data in the response.');

/** Keep only days inside the window, and only where all three values exist. */
const samples = [];
const years = new Set();

for (let i = 0; i < time.length; i += 1) {
  const [year, month, day] = time[i].split('-').map(Number);
  if (month !== 6 || day < WINDOW.from || day > WINDOW.to) continue;

  const high = maxima[i];
  const low = minima[i];
  const rain = precipitation[i];
  if (typeof high !== 'number' || typeof low !== 'number' || typeof rain !== 'number') continue;

  samples.push({ high, low, rain });
  years.add(year);
}

if (samples.length < 100) {
  throw new Error(`Only ${samples.length} usable days — refusing to publish a thin sample.`);
}

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;
const round1 = (n) => Math.round(n * 10) / 10;

/** Nearest-rank percentile. Plenty precise for a "typical June" panel. */
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

const highs = samples.map((s) => s.high);
const lows = samples.map((s) => s.low);
const rainyDays = samples.filter((s) => s.rain >= RAIN_THRESHOLD_MM).length;

const normals = {
  avgHigh: round1(mean(highs)),
  avgLow: round1(mean(lows)),
  warmHigh: round1(percentile(highs, 90)),
  coolHigh: round1(percentile(highs, 10)),
  precipDayPercent: Math.round((rainyDays / samples.length) * 100),
  sampleYears: years.size,
  sampleDays: samples.length,
  windowLabel: `${WINDOW.from}–${WINDOW.to} June`,
  generatedAt: new Date().toISOString().slice(0, 10),
};

const outPath = path.join(root, 'src', 'data', 'climate-june.json');
await writeFile(outPath, `${JSON.stringify(normals, null, 2)}\n`);

console.log(`\n${normals.sampleDays} days across ${normals.sampleYears} years`);
console.log(`  typical high   ${normals.avgHigh} °C   (cool ${normals.coolHigh}, warm ${normals.warmHigh})`);
console.log(`  typical low    ${normals.avgLow} °C`);
console.log(`  rain on        ${normals.precipDayPercent}% of days (≥ ${RAIN_THRESHOLD_MM} mm)`);
console.log(`\nWritten to ${path.relative(root, outPath)}`);
