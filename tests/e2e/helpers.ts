import type { Page } from '@playwright/test';

/**
 * A fixed weather response, so tests never depend on Open-Meteo being reachable.
 *
 * The home page fetches live conditions. Letting that request go out for real
 * makes every test on that page contingent on a third-party API and on the
 * runner's network — which is exactly how the CI accessibility scan first
 * failed: `waitUntil: 'networkidle'` never settled because the fetch hung, and
 * the test timed out rather than reporting anything about accessibility.
 */
const WEATHER = {
  current: { temperature_2m: 19.4, weather_code: 3 },
  daily: {
    time: [
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ],
    weather_code: [0, 1, 3, 61, 80, 95, 2],
    temperature_2m_max: [24.1, 25.6, 22.3, 19.8, 21.4, 23.9, 26.2],
    temperature_2m_min: [12.3, 13.1, 11.7, 10.9, 12.8, 14.2, 13.6],
    precipitation_probability_max: [5, 10, 35, 80, 60, 45, 15],
  },
};

/** Intercept the forecast so the page renders deterministically and offline. */
export async function stubWeather(page: Page): Promise<void> {
  await page.route('**/api.open-meteo.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(WEATHER),
    }),
  );
}

/**
 * Wait for asynchronously-rendered content before measuring or scanning.
 *
 * The forecast cards are built after the fetch resolves, and they are exactly
 * where the 165px horizontal-scroll bug lived — checking the page before they
 * exist would quietly stop testing the thing most likely to break. Pages
 * without a forecast simply fall through.
 */
export async function settle(page: Page): Promise<void> {
  // The container is server-rendered, so this check is instant and tells us
  // whether waiting is worth it. Without it every forecast-free page paid the
  // full timeout — about 45 seconds a run, for nothing.
  if ((await page.locator('[data-weather-days]').count()) === 0) return;

  await page
    .locator('[data-weather-days] .day')
    .first()
    .waitFor({ state: 'attached', timeout: 5000 })
    .catch(() => {
      /* the forecast failed to render; the page is still worth checking */
    });
}
