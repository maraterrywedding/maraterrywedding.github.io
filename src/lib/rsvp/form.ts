/**
 * Browser controller for the RSVP wizard.
 *
 * All the markup is server-rendered — including the attendee card, which lives
 * in a <template> and is cloned. Nothing is built with createElement, because
 * Astro scopes its CSS with attribute selectors and JavaScript-created elements
 * silently miss them.
 *
 * Validation here is a convenience. `validateRsvp` is the same function the
 * backend runs, so this cannot drift from what is actually enforced.
 */

import {
  ALLERGENS,
  LIMITS,
  suggestedRooms,
  type Allergen,
  type Attendee,
  type RsvpPayload,
} from './model';
import { validateRsvp, type FieldErrors } from './validate';
import { MAX_CODE_ATTEMPTS, hashInviteCode, normalizeInviteCode, partyCode } from './invite';

type StepName = 'attendance' | 'contact' | 'guests' | 'stay' | 'travel' | 'extras';

/** Which screens each answer leads through. */
const FLOWS: Record<string, StepName[]> = {
  yes: ['attendance', 'contact', 'guests', 'stay', 'travel', 'extras'],
  maybe: ['attendance', 'contact', 'extras'],
  // Four fields on one screen. Someone declining should be done in seconds.
  no: ['attendance', 'contact', 'extras'],
};

const DRAFT_KEY = 'wedding-rsvp-draft';
const GATE_KEY = 'wedding-rsvp-gate';

export interface FormOptions {
  endpoint: string;
  hotelNights: readonly string[];
  messages: Record<string, string>;
  /** Present in edit mode; the form then updates instead of creating. */
  token?: string;
  locale: string;
  readOnly?: boolean;
  /** SHA-256 of the normalised invitation code, computed at build time. */
  codeHash?: string;
}

interface GateState {
  code: string;
  valid: boolean;
}

export function initRsvpForm(root: HTMLFormElement, options: FormOptions): void {
  const msg = (key: string) => options.messages[key] ?? key;
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const $$ = <T extends Element>(selector: string) => [...root.querySelectorAll<T>(selector)];

  const steps = new Map<StepName, HTMLElement>();
  for (const el of $$<HTMLElement>('[data-step]')) {
    steps.set(el.dataset.step as StepName, el);
  }

  const attendeeList = $<HTMLElement>('[data-attendees]');
  const attendeeTemplate = $<HTMLTemplateElement>('template[data-attendee-template]');
  const songTemplate = $<HTMLTemplateElement>('template[data-song-template]');
  const progressFill = $<HTMLElement>('[data-progress-fill]');
  const progressCount = $<HTMLElement>('[data-progress-count]');
  const errorSummary = $<HTMLElement>('[data-error-summary]');
  const backButton = $<HTMLButtonElement>('[data-back]');
  const nextButton = $<HTMLButtonElement>('[data-next]');
  const submitButton = $<HTMLButtonElement>('[data-submit]');

  let flow: StepName[] = FLOWS.yes!;
  let index = 0;
  /** Only show errors on a field once the guest has tried to move past it. */
  let touched = false;

  /**
   * Read lazily rather than captured at start-up. The edit page renders the
   * form before it knows the token, then sets `data-token` once the record
   * comes back — a captured value would still be the placeholder and the save
   * would be sent against a token that does not exist.
   */
  const currentToken = (): string | undefined => {
    const value = root.dataset.token ?? options.token;
    return value && value !== 'pending' ? value : undefined;
  };

  // -------------------------------------------------------------------------
  // Reading and writing the form
  // -------------------------------------------------------------------------

  const val = (name: string): string => {
    const el = root.elements.namedItem(name);
    if (!el) return '';
    if (el instanceof RadioNodeList) return el.value;
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      return el.value;
    }
    return '';
  };

  const checked = (name: string): boolean => {
    const el = root.elements.namedItem(name);
    return el instanceof HTMLInputElement ? el.checked : false;
  };

  const status = (): string => val('status') || 'yes';

  function readAttendee(card: HTMLElement): Record<string, unknown> {
    const field = <T extends Element>(name: string) => card.querySelector<T>(`[data-field="${name}"]`);
    const isChild = field<HTMLInputElement>('isChild')?.checked ?? false;
    const allergens: Allergen[] = [];
    for (const box of card.querySelectorAll<HTMLInputElement>('[data-field="allergens"]')) {
      if (box.checked) allergens.push(box.value as Allergen);
    }
    const ageRaw = field<HTMLInputElement>('ageAtEvent')?.value ?? '';
    return {
      fullName: field<HTMLInputElement>('fullName')?.value ?? '',
      isChild,
      ageAtEvent: isChild && ageRaw !== '' ? Number(ageRaw) : null,
      diet: card.querySelector<HTMLInputElement>('[data-field="diet"]:checked')?.value ?? '',
      lactoseFree: field<HTMLInputElement>('lactoseFree')?.checked ?? false,
      allergens,
      allergenOther: field<HTMLInputElement>('allergenOther')?.value ?? '',
      needsHighchair: field<HTMLInputElement>('needsHighchair')?.checked ?? false,
    };
  }

  function readPayload(): Record<string, unknown> {
    const songs = $$<HTMLElement>('[data-song]').map((row) => ({
      title: row.querySelector<HTMLInputElement>('[data-field="songTitle"]')?.value ?? '',
      artist: row.querySelector<HTMLInputElement>('[data-field="songArtist"]')?.value ?? '',
    }));

    const nights = $$<HTMLInputElement>('[name="nights"]')
      .filter((box) => box.checked)
      .map((box) => box.value);

    return {
      status: status(),
      leadFirstName: val('leadFirstName'),
      leadLastName: val('leadLastName'),
      email: val('email'),
      phone: val('phone'),
      phoneDialCode: val('phoneDialCode'),
      phoneIsWhatsapp: checked('phoneIsWhatsapp'),
      attendees: $$<HTMLElement>('[data-attendee]').map(readAttendee),
      expectedPartySize: val('expectedPartySize') === '' ? null : Number(val('expectedPartySize')),
      eveningParty: val('eveningParty') || null,
      hotelStatus: val('hotelStatus') || null,
      nights,
      roomsRequested: val('roomsRequested') === '' ? null : Number(val('roomsRequested')),
      cots: Number(val('cots') || 0),
      travelMode: val('travelMode') || null,
      carpoolOfferSeats: Number(val('carpoolOfferSeats') || 0),
      carpoolNeedFrom: val('carpoolNeedFrom') || null,
      carpoolShareConsent: checked('carpoolShareConsent'),
      songs,
      message: val('message'),
      consentPrivacy: checked('consentPrivacy'),
      consentHealthData: checked('consentHealthData'),
      locale: options.locale,
      inviteCode: gate?.code ?? '',
      inviteCodeValid: gate?.valid ?? false,
    };
  }

  // -------------------------------------------------------------------------
  // Attendee repeater
  // -------------------------------------------------------------------------

  function renumberAttendees(): void {
    const cards = $$<HTMLElement>('[data-attendee]');
    cards.forEach((card, i) => {
      const label = card.querySelector<HTMLElement>('[data-attendee-index]');
      if (label) label.textContent = msg('rsvp.guests.person').replace('{n}', String(i + 1));
      // The first card is the lead guest and cannot be removed — they are the
      // person filling the form in.
      const remove = card.querySelector<HTMLElement>('[data-attendee-remove]');
      if (remove) remove.hidden = i === 0;
      for (const input of card.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
        // Radio groups must be unique per card or every card shares one answer.
        input.name = `${input.dataset.field}-${i}`;
      }
    });

    const count = $<HTMLElement>('[data-attendee-count]');
    if (count) count.textContent = msg('rsvp.guests.count').replace('{n}', String(cards.length));

    const addButton = $<HTMLButtonElement>('[data-attendee-add]');
    if (addButton) addButton.disabled = cards.length >= LIMITS.maxParty;

    const maxNote = $<HTMLElement>('[data-attendee-max]');
    if (maxNote) maxNote.hidden = cards.length < LIMITS.maxParty;

    syncSuggestedRooms(cards.length);
  }

  function addAttendee(prefillName = ''): HTMLElement | null {
    if (!attendeeList || !attendeeTemplate) return null;
    if ($$('[data-attendee]').length >= LIMITS.maxParty) return null;

    const fragment = attendeeTemplate.content.cloneNode(true) as DocumentFragment;
    const card = fragment.querySelector<HTMLElement>('[data-attendee]')!;
    if (prefillName) {
      const nameInput = card.querySelector<HTMLInputElement>('[data-field="fullName"]');
      if (nameInput) nameInput.value = prefillName;
    }
    attendeeList.append(fragment);
    renumberAttendees();
    updateReveals();
    return card;
  }

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('[data-attendee-add]')) {
      event.preventDefault();
      const card = addAttendee();
      // Focus the new name field so the keyboard opens on the right control.
      card?.querySelector<HTMLInputElement>('[data-field="fullName"]')?.focus();
      return;
    }

    const removeButton = target.closest<HTMLElement>('[data-attendee-remove]');
    if (removeButton) {
      event.preventDefault();
      removeButton.closest('[data-attendee]')?.remove();
      renumberAttendees();
      save();
      return;
    }

    if (target.closest('[data-song-add]')) {
      event.preventDefault();
      const rows = $$('[data-song]').length;
      if (songTemplate && rows < LIMITS.maxSongs) {
        $<HTMLElement>('[data-songs]')?.append(songTemplate.content.cloneNode(true));
      }
      return;
    }
  });

  // -------------------------------------------------------------------------
  // Steppers
  // -------------------------------------------------------------------------

  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-stepper-step]');
    if (!button) return;
    event.preventDefault();

    const stepper = button.closest<HTMLElement>('[data-stepper]');
    const input = stepper?.querySelector<HTMLInputElement>('input');
    if (!stepper || !input) return;

    const min = Number(input.min || 0);
    const max = Number(input.max || 99);
    const delta = Number(button.dataset.stepperStep);

    // An empty stepper (the child's age) has no current value to step from, so
    // the first press lands on an obvious starting point rather than counting
    // up from a zero the guest never chose.
    const next =
      input.value === ''
        ? delta > 0
          ? Math.min(max, min + 1)
          : min
        : Math.min(max, Math.max(min, Number(input.value) + delta));

    input.value = String(next);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    syncStepper(stepper);
  });

  function syncStepper(stepper: HTMLElement): void {
    const input = stepper.querySelector<HTMLInputElement>('input');
    const display = stepper.querySelector<HTMLElement>('[data-stepper-value]');
    if (!input) return;
    const isEmpty = input.value === '';
    if (display) display.textContent = isEmpty ? '—' : input.value;
    const min = Number(input.min || 0);
    const max = Number(input.max || 99);
    const value = isEmpty ? min : Number(input.value);
    // While empty, both directions stay live so either press sets a value.
    stepper.querySelector<HTMLButtonElement>('[data-stepper-step="-1"]')!.disabled =
      !isEmpty && value <= min;
    stepper.querySelector<HTMLButtonElement>('[data-stepper-step="1"]')!.disabled =
      !isEmpty && value >= max;
  }

  function syncAllSteppers(): void {
    for (const stepper of $$<HTMLElement>('[data-stepper]')) syncStepper(stepper);
  }

  /** Prefill the rooms stepper — the whole point of asking for a headcount first. */
  function syncSuggestedRooms(attendeeCount: number): void {
    const input = root.elements.namedItem('roomsRequested');
    if (!(input instanceof HTMLInputElement) || input.dataset.touched === 'true') return;
    const adults = $$<HTMLElement>('[data-attendee]').filter(
      (card) => !card.querySelector<HTMLInputElement>('[data-field="isChild"]')?.checked,
    );
    input.value = String(
      suggestedRooms(adults.map(() => ({ isChild: false }) as Attendee)) || Math.max(1, Math.ceil(attendeeCount / 2)),
    );
    const stepper = input.closest<HTMLElement>('[data-stepper]');
    if (stepper) syncStepper(stepper);
  }

  root.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.name === 'roomsRequested') {
      target.dataset.touched = 'true';
    }
  });

  // -------------------------------------------------------------------------
  // Progressive disclosure
  // -------------------------------------------------------------------------

  /**
   * Elements carrying `data-show-when="field=a|b"` appear only when that control
   * holds one of the listed values. Everything conditional in the form runs
   * through this, so there is one place for it rather than a rule per field.
   */
  function updateReveals(): void {
    for (const el of $$<HTMLElement>('[data-show-when]')) {
      const [name, values] = el.dataset.showWhen!.split('=');
      const allowed = (values ?? '').split('|');
      el.hidden = !allowed.includes(val(name!));
    }

    // Per-card reveals: the age stepper, the high chair, the allergen list.
    for (const card of $$<HTMLElement>('[data-attendee]')) {
      const isChild = card.querySelector<HTMLInputElement>('[data-field="isChild"]')?.checked ?? false;
      const age = Number(card.querySelector<HTMLInputElement>('[data-field="ageAtEvent"]')?.value ?? '');
      const hasRestrictions =
        card.querySelector<HTMLInputElement>('[data-field="hasRestrictions"]')?.checked ?? false;
      const isVegan = card.querySelector<HTMLInputElement>('[data-field="diet"]:checked')?.value === 'vegan';

      card.querySelector<HTMLElement>('[data-card-reveal="child"]')!.hidden = !isChild;
      // Only offered when it is plausibly relevant.
      card.querySelector<HTMLElement>('[data-card-reveal="highchair"]')!.hidden = !isChild || age > 4;
      card.querySelector<HTMLElement>('[data-card-reveal="restrictions"]')!.hidden = !hasRestrictions;
      // Lactose-free is meaningless for a vegan, so it disappears rather than
      // being offered and then silently discarded.
      card.querySelector<HTMLElement>('[data-card-reveal="lactose"]')!.hidden = isVegan;
    }

    // The health-data consent only appears once there is health data to consent to.
    const healthConsent = $<HTMLElement>('[data-health-consent]');
    if (healthConsent) {
      const anyHealth = $$<HTMLElement>('[data-attendee]').some((card) => {
        const diet = card.querySelector<HTMLInputElement>('[data-field="diet"]:checked')?.value;
        const allergens = card.querySelectorAll<HTMLInputElement>('[data-field="allergens"]:checked');
        const other = card.querySelector<HTMLInputElement>('[data-field="allergenOther"]')?.value.trim();
        const lactose = card.querySelector<HTMLInputElement>('[data-field="lactoseFree"]')?.checked;
        return (diet && diet !== 'meat') || allergens.length > 0 || !!other || !!lactose;
      });
      healthConsent.hidden = !anyHealth;
    }
  }

  root.addEventListener('input', () => {
    updateReveals();
    if (touched) showErrors(currentErrors());
    save();
  });
  root.addEventListener('change', () => {
    updateReveals();
    save();
  });

  // -------------------------------------------------------------------------
  // Validation display
  // -------------------------------------------------------------------------

  function currentErrors(): FieldErrors {
    return validateRsvp(readPayload(), { hotelNights: options.hotelNights }).errors;
  }

  /** Field paths that belong to the step currently on screen. */
  function errorsForStep(errors: FieldErrors, step: StepName): FieldErrors {
    const prefixes: Record<StepName, string[]> = {
      attendance: ['status'],
      contact: ['leadFirstName', 'leadLastName', 'email', 'phone', 'expectedPartySize'],
      guests: ['attendees'],
      stay: ['eveningParty', 'hotelStatus', 'nights', 'roomsRequested', 'cots'],
      travel: ['travelMode', 'carpoolNeedFrom', 'carpoolShareConsent', 'carpoolOfferSeats'],
      extras: ['message', 'consentPrivacy', 'consentHealthData'],
    };
    const wanted = prefixes[step];
    const out: FieldErrors = {};
    for (const [path, key] of Object.entries(errors)) {
      if (wanted.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))) out[path] = key;
    }
    return out;
  }

  function showErrors(errors: FieldErrors): void {
    for (const slot of $$<HTMLElement>('[data-error-for]')) {
      const path = slot.dataset.errorFor!;
      const key = errors[path];
      slot.textContent = key ? msg(key) : '';
      slot.closest('.field, .fieldset, .attendee')?.classList.toggle('has-error', Boolean(key));
    }

    // Attendee errors carry an index; the slots inside cards are addressed by
    // position, so they have to be resolved after the cards exist.
    $$<HTMLElement>('[data-attendee]').forEach((card, i) => {
      for (const slot of card.querySelectorAll<HTMLElement>('[data-card-error-for]')) {
        const field = slot.dataset.cardErrorFor!;
        const key = errors[`attendees.${i}.${field}`];
        slot.textContent = key ? msg(key) : '';
        slot.closest('.field, .fieldset')?.classList.toggle('has-error', Boolean(key));
      }
      const cardHasError = Object.keys(errors).some((path) => path.startsWith(`attendees.${i}.`));
      card.classList.toggle('has-error', cardHasError);
    });
  }

  function focusFirstError(errors: FieldErrors): void {
    const first = Object.keys(errors)[0];
    if (!first) return;
    const match = first.match(/^attendees\.(\d+)\.(.+)$/);
    const target = match
      ? $$<HTMLElement>('[data-attendee]')[Number(match[1])]?.querySelector<HTMLElement>(
          `[data-field="${match[2]}"]`,
        )
      : (root.elements.namedItem(first) as HTMLElement | RadioNodeList | null);

    const el =
      target instanceof RadioNodeList ? (target[0] as HTMLElement | undefined) : (target ?? undefined);
    if (el && 'focus' in el) {
      (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
      (el as HTMLElement).focus({ preventScroll: true });
    }
  }

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------

  function showStep(next: number): void {
    index = Math.min(flow.length - 1, Math.max(0, next));
    const name = flow[index]!;

    for (const [stepName, el] of steps) el.hidden = stepName !== name;

    if (backButton) backButton.hidden = index === 0;
    const isLast = index === flow.length - 1;
    if (nextButton) nextButton.hidden = isLast;
    if (submitButton) submitButton.hidden = !isLast;

    // The attendance screen is not "step 1 of 6" — it is the question that
    // decides how many steps there are.
    const total = flow.length - 1;
    const current = index;
    if (progressFill) progressFill.style.width = `${total === 0 ? 0 : (current / total) * 100}%`;
    if (progressCount) {
      progressCount.textContent =
        current === 0
          ? ''
          : msg('rsvp.step.of').replace('{current}', String(current)).replace('{total}', String(total));
    }

    touched = false;
    showErrors({});
    root.querySelector<HTMLElement>('[data-wizard-top]')?.scrollIntoView({ block: 'start' });
  }

  nextButton?.addEventListener('click', (event) => {
    event.preventDefault();
    touched = true;
    const stepErrors = errorsForStep(currentErrors(), flow[index]!);
    showErrors(currentErrors());
    if (Object.keys(stepErrors).length > 0) {
      if (errorSummary) {
        errorSummary.textContent = msg('rsvp.error.summary');
        errorSummary.hidden = false;
      }
      focusFirstError(stepErrors);
      return;
    }
    if (errorSummary) errorSummary.hidden = true;
    showStep(index + 1);
  });

  backButton?.addEventListener('click', (event) => {
    event.preventDefault();
    if (errorSummary) errorSummary.hidden = true;
    showStep(index - 1);
  });

  // Choosing an attendance option decides the whole flow.
  for (const input of $$<HTMLInputElement>('[name="status"]')) {
    input.addEventListener('change', () => {
      flow = FLOWS[input.value] ?? FLOWS.yes!;
      updateReveals();
      save();
      showStep(1);
    });
  }

  // Enter should advance, not submit, except on the final step.
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const target = event.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement) return;
    if (index < flow.length - 1) {
      event.preventDefault();
      nextButton?.click();
    }
  });

  // -------------------------------------------------------------------------
  // Draft autosave
  // -------------------------------------------------------------------------

  function save(): void {
    if (currentToken() || options.token) return; // editing an existing reply; no local draft
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ payload: readPayload(), index }));
    } catch {
      // Private browsing, quota, or storage disabled. A lost draft is a small
      // annoyance; a thrown exception mid-typing is not acceptable.
    }
  }

  function clearDraft(): void {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * Bring a half-finished reply back.
   *
   * This matters most for the language switcher: switching language is a full
   * page load, and without this a guest who reaches step four and then taps
   * "Deutsch" loses everything they typed. It also covers the ordinary case of
   * wandering off mid-form and coming back.
   *
   * Returns the step to resume on, or null if there was nothing to restore.
   */
  function restoreDraft(): number | null {
    if (currentToken() || options.token) return null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw) as { payload?: Partial<RsvpPayload>; index?: number };
      // Without an attendance answer there is nothing meaningful to resume.
      if (!draft.payload?.status) return null;
      fillForm(draft.payload);
      return typeof draft.index === 'number' ? draft.index : null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Filling the form from a payload (edit mode, and draft restore)
  // -------------------------------------------------------------------------

  function setValue(name: string, value: unknown): void {
    const el = root.elements.namedItem(name);
    if (!el) return;
    if (el instanceof RadioNodeList) {
      for (const radio of el) {
        if (radio instanceof HTMLInputElement) radio.checked = radio.value === String(value);
      }
      return;
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else el.value = value === null || value === undefined ? '' : String(value);
      return;
    }
    if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      el.value = value === null || value === undefined ? '' : String(value);
    }
  }

  function fillAttendee(card: HTMLElement, attendee: Attendee): void {
    const field = <T extends Element>(name: string) => card.querySelector<T>(`[data-field="${name}"]`);
    const name = field<HTMLInputElement>('fullName');
    if (name) name.value = attendee.fullName;

    const isChild = field<HTMLInputElement>('isChild');
    if (isChild) isChild.checked = attendee.isChild;

    const age = field<HTMLInputElement>('ageAtEvent');
    if (age) age.value = attendee.ageAtEvent === null ? '' : String(attendee.ageAtEvent);

    for (const radio of card.querySelectorAll<HTMLInputElement>('[data-field="diet"]')) {
      radio.checked = radio.value === attendee.diet;
    }

    const lactose = field<HTMLInputElement>('lactoseFree');
    if (lactose) lactose.checked = attendee.lactoseFree;

    for (const box of card.querySelectorAll<HTMLInputElement>('[data-field="allergens"]')) {
      box.checked = attendee.allergens.includes(box.value as Allergen);
    }

    const other = field<HTMLInputElement>('allergenOther');
    if (other) other.value = attendee.allergenOther;

    const restrictions = field<HTMLInputElement>('hasRestrictions');
    if (restrictions) {
      restrictions.checked =
        attendee.allergens.length > 0 || attendee.allergenOther !== '' || attendee.lactoseFree;
    }

    const highchair = field<HTMLInputElement>('needsHighchair');
    if (highchair) highchair.checked = attendee.needsHighchair;
  }

  function fillForm(payload: Partial<RsvpPayload>): void {
    for (const name of [
      'status',
      'leadFirstName',
      'leadLastName',
      'email',
      'phone',
      'phoneIsWhatsapp',
      'expectedPartySize',
      'eveningParty',
      'hotelStatus',
      'roomsRequested',
      'cots',
      'travelMode',
      'carpoolOfferSeats',
      'carpoolNeedFrom',
      'carpoolShareConsent',
      'message',
      'consentPrivacy',
      'consentHealthData',
    ] as const) {
      if (name in payload) setValue(name, (payload as Record<string, unknown>)[name]);
    }

    for (const box of $$<HTMLInputElement>('[name="nights"]')) {
      box.checked = (payload.nights ?? []).includes(box.value);
    }

    if (payload.attendees?.length && attendeeList) {
      attendeeList.innerHTML = '';
      for (const attendee of payload.attendees) {
        const card = addAttendee();
        if (card) fillAttendee(card, attendee);
      }
    }

    if (payload.songs?.length) {
      const rows = $$<HTMLElement>('[data-song]');
      payload.songs.forEach((song, i) => {
        const row = rows[i] ?? (songTemplate ? appendSong() : null);
        if (!row) return;
        row.querySelector<HTMLInputElement>('[data-field="songTitle"]')!.value = song.title;
        row.querySelector<HTMLInputElement>('[data-field="songArtist"]')!.value = song.artist;
      });
    }

    if (payload.status) flow = FLOWS[payload.status] ?? FLOWS.yes!;

    renumberAttendees();
    updateReveals();
    syncAllSteppers();
  }

  function appendSong(): HTMLElement | null {
    if (!songTemplate) return null;
    const container = $<HTMLElement>('[data-songs]');
    if (!container) return null;
    container.append(songTemplate.content.cloneNode(true));
    return $$<HTMLElement>('[data-song]').at(-1) ?? null;
  }

  // -------------------------------------------------------------------------
  // Submitting
  // -------------------------------------------------------------------------

  root.addEventListener('submit', async (event) => {
    event.preventDefault();
    touched = true;

    const payload = readPayload();
    const result = validateRsvp(payload, { hotelNights: options.hotelNights });
    if (!result.ok) {
      showErrors(result.errors);
      if (errorSummary) {
        errorSummary.textContent = msg('rsvp.error.summary');
        errorSummary.hidden = false;
      }
      // Jump back to whichever step actually holds the problem.
      const failing = flow.findIndex((step) => Object.keys(errorsForStep(result.errors, step)).length > 0);
      if (failing >= 0 && failing !== index) showStep(failing);
      touched = true;
      showErrors(result.errors);
      focusFirstError(result.errors);
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = msg('rsvp.nav.sending');
    }
    if (errorSummary) errorSummary.hidden = true;

    try {
      // `text/plain` keeps this a CORS "simple request". Anything else triggers
      // a preflight, which Google Apps Script cannot answer — the request would
      // fail in production while working perfectly against a local server.
      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: currentToken() ? 'update' : 'create',
          token: currentToken(),
          locale: options.locale,
          hp: val('hp'),
          payload: result.value,
        }),
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? 'FAILED');

      clearDraft();
      showSuccess(result.value!, data);
    } catch (error) {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = msg(currentToken() ? 'rsvp.nav.save' : 'rsvp.nav.send');
      }
      if (errorSummary) {
        const closed = error instanceof Error && error.message === 'CLOSED';
        errorSummary.textContent = msg(closed ? 'rsvp.error.closed' : 'rsvp.error.network');
        errorSummary.hidden = false;
        errorSummary.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  });

  function showSuccess(payload: RsvpPayload, data: Record<string, unknown>): void {
    const panel = document.querySelector<HTMLElement>('[data-panel="success"]');
    const formPanel = document.querySelector<HTMLElement>('[data-panel="form"]');
    if (!panel || !formPanel) return;

    const heading = panel.querySelector<HTMLElement>('[data-success-heading]');
    const body = panel.querySelector<HTMLElement>('[data-success-body]');
    const emailed = panel.querySelector<HTMLElement>('[data-success-emailed]');
    const editLink = panel.querySelector<HTMLAnchorElement>('[data-success-edit]');
    const duplicate = panel.querySelector<HTMLElement>('[data-success-duplicate]');
    const summary = panel.querySelector<HTMLElement>('[data-success-summary]');

    const key =
      payload.status === 'no'
        ? 'rsvp.success.noHeading'
        : payload.status === 'maybe'
          ? 'rsvp.success.maybeHeading'
          : 'rsvp.success.heading';
    if (heading) heading.textContent = msg(key).replace('{name}', payload.leadFirstName);

    if (body) {
      body.textContent =
        payload.status === 'no'
          ? msg('rsvp.success.noBody')
          : payload.status === 'maybe'
            ? msg('rsvp.success.maybeBody')
            : '';
      body.hidden = body.textContent === '';
    }

    if (emailed) emailed.textContent = msg('rsvp.success.emailed').replace('{email}', payload.email);
    if (editLink && typeof data.editUrl === 'string') editLink.href = data.editUrl;
    if (duplicate) duplicate.hidden = data.duplicate !== true;

    // The party's own reference, derived from their token so it never has to be
    // stored separately or kept in sync.
    const codeBlock = panel.querySelector<HTMLElement>('[data-party-code]');
    const codeValue = panel.querySelector<HTMLElement>('[data-party-code-value]');
    if (codeBlock && codeValue && typeof data.token === 'string' && data.token) {
      codeValue.textContent = partyCode(data.token);
      codeBlock.hidden = false;
    }

    // A read-back of what they actually said. Guests trust what they can see,
    // and it catches a mis-tap before the couple have to chase it.
    if (summary && payload.status === 'yes') {
      const names = payload.attendees.map((a) => a.fullName).join(', ');
      const diets = payload.attendees
        .map((a) => `${a.fullName.split(' ')[0]}: ${msg(`rsvp.diet.${a.diet}`)}`)
        .join(' · ');
      const rows: Array<[string, string]> = [
        [msg('rsvp.summary.who'), names],
        [msg('rsvp.summary.food'), diets],
      ];
      if (payload.hotelStatus === 'yes') {
        rows.push([
          msg('rsvp.summary.hotel'),
          msg('rsvp.stay.readback')
            .replace('{nights}', String(payload.nights.length))
            .replace('{rooms}', String(payload.roomsRequested ?? 1)),
        ]);
      }
      if (payload.travelMode) {
        rows.push([msg('rsvp.summary.travel'), msg(`rsvp.travelMode.${payload.travelMode}`)]);
      }
      summary.innerHTML = '';
      for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'summary__row';
        const l = document.createElement('span');
        l.className = 'summary__label';
        l.textContent = label;
        const v = document.createElement('span');
        v.className = 'summary__value';
        v.textContent = value;
        row.append(l, v);
        summary.append(row);
      }
      summary.hidden = false;
    } else if (summary) {
      summary.hidden = true;
    }

    formPanel.hidden = true;
    panel.hidden = false;
    panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // -------------------------------------------------------------------------
  // Invitation code gate
  // -------------------------------------------------------------------------

  let gate: GateState | null = null;

  function readGate(): GateState | null {
    try {
      const raw = sessionStorage.getItem(GATE_KEY);
      return raw ? (JSON.parse(raw) as GateState) : null;
    } catch {
      return null;
    }
  }

  function openForm(state: GateState): void {
    gate = state;
    try {
      sessionStorage.setItem(GATE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable; the guest just re-enters it if they reload */
    }
    const gatePanel = document.querySelector<HTMLElement>('[data-panel="gate"]');
    const formPanel = document.querySelector<HTMLElement>('[data-panel="form"]');
    const flagged = document.querySelector<HTMLElement>('[data-code-flagged]');
    if (gatePanel) gatePanel.hidden = true;
    if (formPanel) formPanel.hidden = false;
    // Say so rather than letting them think the code worked.
    if (flagged) flagged.hidden = state.valid;
  }

  function setupGate(): void {
    const gatePanel = document.querySelector<HTMLElement>('[data-panel="gate"]');
    const formPanel = document.querySelector<HTMLElement>('[data-panel="form"]');
    if (!gatePanel || !formPanel) return;

    // Someone arriving on their own edit link has already proved who they are.
    if (currentToken() || options.token || !options.codeHash) {
      openForm({ code: '', valid: true });
      return;
    }

    const remembered = readGate();
    if (remembered) {
      openForm(remembered);
      return;
    }

    gatePanel.hidden = false;
    formPanel.hidden = true;

    const input = gatePanel.querySelector<HTMLInputElement>('[data-gate-input]')!;
    const button = gatePanel.querySelector<HTMLButtonElement>('[data-gate-submit]')!;
    const error = gatePanel.querySelector<HTMLElement>('[data-gate-error]')!;
    let attempts = 0;

    const attempt = async () => {
      const typed = normalizeInviteCode(input.value);
      const hashed = typed ? await hashInviteCode(typed) : '';

      if (hashed === options.codeHash) {
        openForm({ code: typed, valid: true });
        return;
      }

      attempts += 1;
      if (attempts >= MAX_CODE_ATTEMPTS) {
        // Never turn a real guest away. An elderly relative who has mislaid the
        // card should not cost the couple an attendee — the reply is accepted
        // and flagged for them to check instead.
        openForm({ code: typed, valid: false });
        return;
      }

      error.textContent = msg('rsvp.gate.wrong');
      input.focus();
      input.select();
    };

    button.addEventListener('click', (event) => {
      event.preventDefault();
      void attempt();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void attempt();
      }
    });

    input.addEventListener('input', () => {
      error.textContent = '';
    });
  }

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------

  if (options.readOnly) {
    for (const control of $$<HTMLInputElement>('input, select, textarea, button')) {
      control.disabled = true;
    }
    return;
  }

  /**
   * Seed the first attendee card from the lead guest's name, so the common
   * case of "just me" is not typed twice.
   *
   * The seeded value is marked, so a later edit to the surname can correct it —
   * blurring the first-name field alone would otherwise leave the card reading
   * "Anna" forever. Once the guest types in the card themselves the mark is
   * cleared and their text is never overwritten.
   */
  const seedFirstCard = () => {
    const first = $$<HTMLElement>('[data-attendee]')[0];
    const nameInput = first?.querySelector<HTMLInputElement>('[data-field="fullName"]');
    if (!nameInput) return;
    const untouched = nameInput.value.trim() === '' || nameInput.dataset.autofilled === 'true';
    if (!untouched) return;

    const full = `${val('leadFirstName')} ${val('leadLastName')}`.trim();
    if (!full) return;
    nameInput.value = full;
    nameInput.dataset.autofilled = 'true';
  };

  for (const name of ['leadFirstName', 'leadLastName']) {
    const el = root.elements.namedItem(name);
    if (el instanceof HTMLInputElement) {
      el.addEventListener('blur', seedFirstCard);
      el.addEventListener('input', seedFirstCard);
    }
  }

  root.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.dataset.field === 'fullName') {
      delete target.dataset.autofilled;
    }
  });

  if ($$('[data-attendee]').length === 0) addAttendee();

  renumberAttendees();
  updateReveals();
  syncAllSteppers();

  setupGate();

  const resumeAt = restoreDraft();
  showStep(resumeAt ?? 0);

  // Expose for the edit page, which loads a payload and then fills the form.
  (root as unknown as { rsvpFill: typeof fillForm }).rsvpFill = fillForm;
  (root as unknown as { rsvpShowStep: typeof showStep }).rsvpShowStep = showStep;
}

export { ALLERGENS };
