import { expect, test, type Page } from '@playwright/test';

/**
 * The flows that would actually cost the couple something if they broke:
 * a guest cannot submit, a guest cannot get back in to change their answer, or
 * the form quietly accepts something the caterer then cannot act on.
 */

/** Unique per run — the mock backend deduplicates by email on purpose. */
const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/**
 * There is no code printed on the invitations, so the form opens directly.
 * The entry gate still exists in the code and switches on if
 * `EVENT.rsvp.inviteCode` is ever set — this clears it either way.
 */
async function unlock(page: Page) {
  const gate = page.locator('[data-panel="gate"]');
  if (await gate.isVisible()) {
    await page.fill('[data-gate-input]', 'GROHNDE27');
    await page.locator('[data-gate-submit]').click();
  }
  await expect(page.locator('[data-panel="form"]')).toBeVisible();
}

async function chooseAttendance(page: Page, value: 'yes' | 'maybe' | 'no') {
  await page.locator(`input[name="status"][value="${value}"]`).check();
}

async function fillContact(page: Page, email: string, withPhone = true) {
  await page.fill('#leadFirstName', 'Anna');
  await page.fill('#leadLastName', 'Müller');
  await page.fill('#email', email);
  if (withPhone) await page.fill('#phone', '0170 1234567');
}

const next = (page: Page) => page.locator('[data-next]').click();

test.describe('RSVP wizard', () => {
  test('a party of three, one child and one vegan, reaches the success screen', async ({ page }) => {
    const email = uniqueEmail('party');
    await page.goto('/rsvp');

    await unlock(page);

    await chooseAttendance(page, 'yes');
    await fillContact(page, email);
    await next(page);

    // The first card is pre-seeded from the lead guest's name.
    const cards = page.locator('[data-attendee]');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().locator('[data-field="fullName"]')).toHaveValue('Anna Müller');
    await cards.first().locator('input[data-field="diet"][value="meat"]').check();

    await page.locator('[data-attendee-add]').click();
    await cards.nth(1).locator('[data-field="fullName"]').fill('Jonas Müller');
    await cards.nth(1).locator('input[data-field="diet"][value="vegan"]').check();

    await page.locator('[data-attendee-add]').click();
    await cards.nth(2).locator('[data-field="fullName"]').fill('Lena Müller');
    await cards.nth(2).locator('input[data-field="isChild"]').check();
    // The age stepper only appears once someone is marked as a child.
    const ageBlock = cards.nth(2).locator('[data-card-reveal="child"]');
    await expect(ageBlock).toBeVisible();
    // Starts blank so an age is never submitted by default.
    await expect(ageBlock.locator('[data-stepper-value]')).toHaveText('—');
    for (let i = 0; i < 4; i += 1) await ageBlock.locator('[data-stepper-step="1"]').click();
    await expect(ageBlock.locator('[data-stepper-value]')).toHaveText('4');
    await cards.nth(2).locator('input[data-field="diet"][value="meat"]').check();

    await expect(page.locator('[data-attendee-count]')).toContainText('3');
    await next(page);

    // Staying over
    await page.locator('input[name="eveningParty"][value="yes"]').check();
    await page.locator('input[name="hotelStatus"][value="yes"]').check();
    await page.locator('input[name="nights"]').first().check();
    await next(page);

    // Travel
    await page.locator('input[name="travelMode"][value="own_car"]').check();
    await next(page);

    // A vegan is in the party, so the health-data consent must have appeared.
    const healthConsent = page.locator('[data-health-consent]');
    await expect(healthConsent).toBeVisible();
    await page.locator('input[name="consentPrivacy"]').check();
    await page.locator('input[name="consentHealthData"]').check();
    await page.locator('[data-submit]').click();

    const success = page.locator('[data-panel="success"]');
    await expect(success).toBeVisible();
    await expect(success.locator('[data-success-heading]')).toContainText('Anna');
    await expect(success.locator('[data-success-emailed]')).toContainText(email);

    // The read-back must show what they actually said.
    const summary = success.locator('[data-success-summary]');
    await expect(summary).toContainText('Jonas Müller');
    await expect(summary).toContainText('Vegan');

    const editHref = await success.locator('[data-success-edit]').getAttribute('href');
    expect(editHref).toContain('/rsvp/edit?t=');
  });

  test('an edit link reopens the answer and saves a change', async ({ page }) => {
    const email = uniqueEmail('edit');
    await page.goto('/rsvp');

    await unlock(page);

    await chooseAttendance(page, 'yes');
    await fillContact(page, email);
    await next(page);
    await page.locator('[data-attendee]').first().locator('input[data-field="diet"][value="meat"]').check();
    await next(page);
    await page.locator('input[name="eveningParty"][value="yes"]').check();
    await page.locator('input[name="hotelStatus"][value="no"]').check();
    await next(page);
    await page.locator('input[name="travelMode"][value="train_taxi"]').check();
    await next(page);
    await page.locator('input[name="consentPrivacy"]').check();
    await page.locator('[data-submit]').click();

    const editHref = await page
      .locator('[data-panel="success"] [data-success-edit]')
      .getAttribute('href');
    expect(editHref).toBeTruthy();

    await page.goto(editHref!);

    // The form comes back pre-filled, on the contact step rather than back at
    // the attendance question.
    await expect(page.locator('[data-edit-form]')).toBeVisible();
    await expect(page.locator('#email')).toHaveValue(email);
    await expect(page.locator('[data-edit-banner]')).toContainText('Anna Müller');

    // Add a second person and save.
    await page.locator('[data-next]').click(); // contact -> guests
    await page.locator('[data-attendee-add]').click();
    const second = page.locator('[data-attendee]').nth(1);
    await second.locator('[data-field="fullName"]').fill('Chris Müller');
    await second.locator('input[data-field="diet"][value="meat"]').check();
    await page.locator('[data-next]').click(); // guests -> stay
    await page.locator('[data-next]').click(); // stay -> travel
    await page.locator('[data-next]').click(); // travel -> extras
    await page.locator('[data-submit]').click();

    await expect(page.locator('[data-panel="success"]')).toBeVisible();
  });

  test('the form opens straight away — no code is printed on the invitations', async ({ page }) => {
    await page.goto('/rsvp');
    await expect(page.locator('[data-panel="form"]')).toBeVisible();
    await expect(page.locator('[data-panel="gate"]')).toBeHidden();
    await expect(page.locator('input[name="status"][value="yes"]')).toBeVisible();
  });

  test('a party code gets a guest back into their answer without the email', async ({ page }) => {
    const email = uniqueEmail('recover');
    await page.goto('/rsvp');
    await unlock(page);
    await chooseAttendance(page, 'yes');
    await fillContact(page, email);
    await next(page);
    await page.locator('[data-attendee]').first().locator('input[data-field="diet"][value="meat"]').check();
    await next(page);
    await page.locator('input[name="eveningParty"][value="yes"]').check();
    await page.locator('input[name="hotelStatus"][value="no"]').check();
    await next(page);
    await page.locator('input[name="travelMode"][value="own_car"]').check();
    await next(page);
    await page.locator('input[name="consentPrivacy"]').check();
    await page.locator('[data-submit]').click();

    const code = await page.locator('[data-party-code-value]').textContent();
    expect(code).toMatch(/^MT-[A-Z2-9]{6}$/);

    // Arrive at the edit page with no link at all, as someone who lost the email.
    await page.goto('/rsvp/edit');
    await expect(page.locator('[data-edit-find]')).toBeVisible();

    await page.fill('#findEmail', email);
    await page.fill('#findCode', code!);
    await page.locator('[data-find-submit]').click();

    // Lands on the real edit page, pre-filled.
    await expect(page.locator('[data-edit-form]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#email')).toHaveValue(email);
    await expect(page).toHaveURL(/\?t=/);
  });

  test('the code alone does not open somebody else’s answer', async ({ page }) => {
    const email = uniqueEmail('mine');
    await page.goto('/rsvp');
    await unlock(page);
    await chooseAttendance(page, 'no');
    await fillContact(page, email, false);
    await next(page);
    await page.locator('input[name="consentPrivacy"]').check();
    await page.locator('[data-submit]').click();
    const code = await page.locator('[data-party-code-value]').textContent();

    await page.goto('/rsvp/edit');
    await page.fill('#findEmail', 'someone-else@example.com');
    await page.fill('#findCode', code!);
    await page.locator('[data-find-submit]').click();

    await expect(page.locator('[data-find-error]')).not.toBeEmpty();
    await expect(page.locator('[data-edit-form]')).toBeHidden();
  });

  test('a successful reply hands back a party code', async ({ page }) => {
    await page.goto('/rsvp');
    await unlock(page);
    await chooseAttendance(page, 'no');
    await fillContact(page, uniqueEmail('code'), false);
    await next(page);
    await page.locator('input[name="consentPrivacy"]').check();
    await page.locator('[data-submit]').click();

    const code = page.locator('[data-party-code-value]');
    await expect(code).toBeVisible();
    await expect(code).toHaveText(/^MT-[A-Z2-9]{6}$/);
  });

  test('answers survive switching language mid-form', async ({ page }) => {
    await page.goto('/rsvp');
    await unlock(page);
    await chooseAttendance(page, 'yes');
    await fillContact(page, 'lang-test@example.com');
    await next(page);

    // Switch to German from the footer, then come back to the form.
    await page.locator('.site-footer a[hreflang="de-DE"]').click();
    await expect(page).toHaveURL(/\/de\/rsvp/);

    // The gate stays open and the typed answers are still there.
    await expect(page.locator('[data-panel="form"]')).toBeVisible();
    await expect(page.locator('#email')).toHaveValue('lang-test@example.com');
    await expect(page.locator('#leadFirstName')).toHaveValue('Anna');
  });

  test('a bad link offers a way back in rather than a dead end', async ({ page }) => {
    await page.goto('/rsvp/edit?t=not-a-real-token');
    await expect(page.locator('[data-edit-find]')).toBeVisible();
    await expect(page.locator('[data-edit-badtoken]')).toBeVisible();
    await expect(page.locator('[data-edit-form]')).toBeHidden();
  });

  test('arriving with no link at all is treated as normal, not an error', async ({ page }) => {
    await page.goto('/rsvp/edit');
    await expect(page.locator('[data-edit-find]')).toBeVisible();
    // No "that link is broken" warning — they never had one.
    await expect(page.locator('[data-edit-badtoken]')).toBeHidden();
  });

  test('declining takes four fields and one screen', async ({ page }) => {
    const email = uniqueEmail('decline');
    await page.goto('/rsvp');

    await unlock(page);

    await chooseAttendance(page, 'no');
    await fillContact(page, email, false);
    // No phone is asked for from someone who cannot come.
    await expect(page.locator('#phone')).toBeHidden();
    await next(page);

    // Straight to the final screen — no guests, hotel or travel questions.
    await expect(page.locator('[data-step="extras"]')).toBeVisible();
    await expect(page.locator('[data-step="guests"]')).toBeHidden();
    await expect(page.locator('[data-step="stay"]')).toBeHidden();

    await page.locator('input[name="consentPrivacy"]').check();
    await page.locator('[data-submit]').click();

    await expect(page.locator('[data-panel="success"] [data-success-heading]')).toContainText(
      'Anna',
    );
  });

  test("a child with no age entered cannot be submitted", async ({ page }) => {
    await page.goto('/rsvp');
    await unlock(page);
    await chooseAttendance(page, 'yes');
    await fillContact(page, uniqueEmail('age'));
    await next(page);

    const card = page.locator('[data-attendee]').first();
    await card.locator('input[data-field="diet"][value="meat"]').check();
    await card.locator('input[data-field="isChild"]').check();
    await next(page);

    // Still on the guests step, with the age flagged on that specific card.
    await expect(page.locator('[data-step="guests"]')).toBeVisible();
    await expect(card.locator('[data-card-error-for="ageAtEvent"]')).not.toBeEmpty();
  });

  test('validation blocks the step and points at the first problem', async ({ page }) => {
    await page.goto('/rsvp');
    await unlock(page);
    await chooseAttendance(page, 'yes');
    await next(page);

    // Still on the contact step, with errors shown.
    await expect(page.locator('[data-step="contact"]')).toBeVisible();
    await expect(page.locator('[data-error-for="leadFirstName"]')).not.toBeEmpty();
    await expect(page.locator('[data-error-for="email"]')).not.toBeEmpty();
    await expect(page.locator('[data-error-summary]')).toBeVisible();

    // A malformed email is caught rather than accepted.
    await page.fill('#leadFirstName', 'Anna');
    await page.fill('#leadLastName', 'Müller');
    await page.fill('#email', 'anna-at-example.com');
    await page.fill('#phone', '0170 1234567');
    await next(page);
    await expect(page.locator('[data-step="contact"]')).toBeVisible();
    await expect(page.locator('[data-error-for="email"]')).not.toBeEmpty();

    // Fixing it lets them through.
    await page.fill('#email', uniqueEmail('validation'));
    await next(page);
    await expect(page.locator('[data-step="guests"]')).toBeVisible();
  });

  test('the health-data consent is demanded before any diet can be submitted', async ({ page }) => {
    await page.goto('/rsvp');
    await unlock(page);
    await chooseAttendance(page, 'yes');
    await fillContact(page, uniqueEmail('consent'));
    await next(page);

    await page
      .locator('[data-attendee]')
      .first()
      .locator('input[data-field="diet"][value="vegetarian"]')
      .check();
    await next(page);
    await page.locator('input[name="eveningParty"][value="yes"]').check();
    await page.locator('input[name="hotelStatus"][value="no"]').check();
    await next(page);
    await page.locator('input[name="travelMode"][value="own_car"]').check();
    await next(page);

    await page.locator('input[name="consentPrivacy"]').check();
    await page.locator('[data-submit]').click();

    // Blocked, and still on the form.
    await expect(page.locator('[data-panel="success"]')).toBeHidden();
    await expect(page.locator('[data-error-for="consentHealthData"]')).not.toBeEmpty();

    await page.locator('input[name="consentHealthData"]').check();
    await page.locator('[data-submit]').click();
    await expect(page.locator('[data-panel="success"]')).toBeVisible();
  });

  test('sharing a phone number with another guest needs its own consent', async ({ page }) => {
    await page.goto('/rsvp');
    await unlock(page);
    await chooseAttendance(page, 'yes');
    await fillContact(page, uniqueEmail('carpool'));
    await next(page);
    await page.locator('[data-attendee]').first().locator('input[data-field="diet"][value="meat"]').check();
    await next(page);
    await page.locator('input[name="eveningParty"][value="yes"]').check();
    await page.locator('input[name="hotelStatus"][value="no"]').check();
    await next(page);

    await page.locator('input[name="travelMode"][value="carpool"]').check();
    await page.selectOption('#carpoolNeedFrom', 'hannover');
    await next(page);

    await expect(page.locator('[data-error-for="carpoolShareConsent"]')).not.toBeEmpty();
  });
});

test.describe('page health', () => {
  const paths = ['/', '/schedule', '/travel', '/stay', '/dress-code', '/questions', '/photos', '/rsvp'];

  for (const path of paths) {
    test(`${path} has no horizontal scroll and no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));

      await page.goto(path, { waitUntil: 'networkidle' });

      const scrolls = await page.evaluate(() => {
        window.scrollTo({ left: 9999, behavior: 'instant' });
        const x = window.scrollX;
        window.scrollTo({ left: 0, behavior: 'instant' });
        return x > 0;
      });
      expect(scrolls, 'page scrolls sideways').toBe(false);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('language switching', () => {
  test('keeps the edit token when switching language', async ({ page }) => {
    await page.goto('/rsvp/edit?t=abc123');
    const german = page.locator('.site-footer a[hreflang="de-DE"]');
    await expect(german).toHaveAttribute('href', /\/de\/rsvp\/edit\?t=abc123/);
  });

  test('keeps the current page when switching language', async ({ page }) => {
    await page.goto('/schedule');
    await page.locator('.site-footer a[hreflang="pt-BR"]').click();
    await expect(page).toHaveURL(/\/pt\/schedule/);
  });
});

