import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Automated accessibility checks.
 *
 * Axe catches perhaps a third of real accessibility problems — it is a floor,
 * not a ceiling. It cannot tell whether alt text is meaningful, whether the
 * reading order makes sense, or whether an error message is comprehensible.
 * Those need a person. What it does catch reliably is contrast, missing labels,
 * broken landmark structure and invalid ARIA, all of which are easy to
 * introduce by accident and tedious to find by hand.
 *
 * Guests at a wedding span every age. Some will be reading this on a phone in
 * bright sun, some with reading glasses, some with a screen reader.
 */

const PAGES = [
  '/',
  '/schedule',
  '/travel',
  '/stay',
  '/dress-code',
  '/questions',
  '/photos',
  '/privacy',
  '/imprint',
  '/rsvp',
  // Reached without a token, so it shows the "find your answer" form.
  '/rsvp/edit',
];

const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

/** Readable failure output — axe's raw JSON is unusable in a test report. */
function describe(results: Awaited<ReturnType<typeof scan>>): string {
  return results.violations
    .map((v) => {
      const where = v.nodes.slice(0, 3).map((n) => `      ${n.target.join(' ')}`).join('\n');
      return `  [${v.impact}] ${v.id}: ${v.help}\n${where}`;
    })
    .join('\n\n');
}

test.describe('accessibility', () => {
  for (const path of PAGES) {
    test(`${path} has no automatically detectable violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const results = await scan(page);
      expect(results.violations, `\n${describe(results)}\n`).toEqual([]);
    });
  }

  test('the RSVP form is clean once it is open', async ({ page }) => {
    await page.goto('/rsvp');
    await expect(page.locator('[data-panel="form"]')).toBeVisible();

    const results = await scan(page);
    expect(results.violations, `\n${describe(results)}\n`).toEqual([]);
  });

  test('an attendee card with everything revealed is clean', async ({ page }) => {
    await page.goto('/rsvp');
    await page.locator('input[name="status"][value="yes"]').check();
    await page.fill('#leadFirstName', 'Anna');
    await page.fill('#leadLastName', 'Müller');
    await page.fill('#email', 'anna@example.com');
    await page.fill('#phone', '0170 1234567');
    await page.locator('[data-next]').click();

    // Open every conditional block on the card at once.
    const card = page.locator('[data-attendee]').first();
    await card.locator('input[data-field="isChild"]').check();
    await card.locator('input[data-field="hasRestrictions"]').check();
    await expect(card.locator('[data-card-reveal="restrictions"]')).toBeVisible();

    const results = await scan(page);
    expect(results.violations, `\n${describe(results)}\n`).toEqual([]);
  });

  test('German and Portuguese are declared, so screen readers switch voice', async ({ page }) => {
    for (const [path, expected] of [
      ['/', 'en-GB'],
      ['/de/', 'de-DE'],
      ['/pt/', 'pt-BR'],
    ] as const) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', expected);
    }
  });

  test('every page has exactly one h1 and a main landmark', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator('h1'), `${path}`).toHaveCount(1);
      await expect(page.locator('main'), `${path}`).toHaveCount(1);
    }
  });

  test('the skip link works and is reachable by keyboard', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();

    // It slides in over 120ms; measuring immediately catches it mid-flight.
    await expect
      .poll(async () => (await skip.boundingBox())?.y ?? -1, { timeout: 2000 })
      .toBeGreaterThanOrEqual(0);
  });

  test('tap targets on the RSVP form are big enough for a thumb', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile', 'mobile only');

    await page.goto('/rsvp');
    await page.locator('input[name="status"][value="yes"]').check();
    await page.locator('[data-next]').click();

    const tooSmall: string[] = [];
    for (const button of await page.locator('button:visible, a.button:visible').all()) {
      const box = await button.boundingBox();
      if (!box) continue;
      // 44px is the WCAG 2.2 target-size minimum.
      if (box.width < 44 || box.height < 44) {
        tooSmall.push(`${(await button.textContent())?.trim()} ${box.width}×${box.height}`);
      }
    }
    expect(tooSmall).toEqual([]);
  });
});
