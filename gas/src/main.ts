/**
 * Apps Script entry point.
 *
 * A thin adapter and nothing else: it binds the real Google globals to the
 * ports in handlers.ts, which holds all the logic and knows nothing about
 * Google. Keep it that way — anything with a decision in it belongs next door,
 * where Vitest can reach it.
 */

import {
  dispatchGet,
  dispatchPost,
  type BackendConfig,
  type Deps,
} from './handlers.ts';
import { renderConfirmationEmail } from './mail.ts';
import {
  ATTENDEE_COLUMNS,
  HANDOFF_COLUMNS,
  HOTEL_COLUMNS,
  RESPONSE_COLUMNS,
  TABS,
  attendeeRows,
  cateringSummary,
  createSheetPort,
  handoffRows,
  hotelRows,
  parseResponseRow,
} from './sheet.ts';

declare const SpreadsheetApp: any;
declare const ContentService: any;
declare const LockService: any;
declare const MailApp: any;
declare const Utilities: any;

const CONFIG_DEFAULTS: Record<string, string> = {
  softDeadline: '2026-11-01T23:59:59+01:00',
  hardLock: '2026-12-15T23:59:59+01:00',
  eventAt: '2027-06-11T11:00:00+02:00',
  hotelNights: '2027-06-10,2027-06-11',
  inviteCode: 'GROHNDE27',
  siteOrigin: 'http://localhost:4321',
  replyTo: '',
  coupleNames: 'Mara & Terry',
};

/**
 * Read from the Config tab on EVERY request, never cached.
 *
 * This is what lets the couple move a deadline, change the invitation code or
 * fix the site URL by editing one cell — no redeploy, no rebuild, and crucially
 * no new /exec URL, which would break every edit link already emailed out.
 */
function readConfig(): BackendConfig {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(TABS.config);

  if (!sheet) {
    sheet = book.insertSheet(TABS.config);
    sheet.appendRow(['key', 'value']);
    for (const [key, value] of Object.entries(CONFIG_DEFAULTS)) sheet.appendRow([key, value]);
    sheet.setFrozenRows(1);
  }

  const values: unknown[][] = sheet.getDataRange().getValues();
  const map: Record<string, string> = { ...CONFIG_DEFAULTS };
  for (const [key, value] of values.slice(1)) {
    if (key) map[String(key).trim()] = String(value ?? '').trim();
  }

  return {
    softDeadline: map.softDeadline!,
    hardLock: map.hardLock!,
    eventAt: map.eventAt!,
    hotelNights: map.hotelNights!.split(',').map((s) => s.trim()).filter(Boolean),
    inviteCode: map.inviteCode!,
    siteOrigin: map.siteOrigin!,
    replyTo: map.replyTo || Session.getEffectiveUser().getEmail(),
    coupleNames: map.coupleNames!,
  };
}

declare const Session: any;

function buildDeps(): Deps {
  const config = readConfig();
  return {
    sheet: createSheetPort(config.siteOrigin),
    mailer: {
      send({ to, subject, body, replyTo }) {
        MailApp.sendEmail({ to, subject, body, replyTo: replyTo || undefined, name: config.coupleNames });
      },
    },
    config: readConfig,
    now: () => new Date(),
    uuid: () => Utilities.getUuid(),
    lock(fn) {
      const lock = LockService.getScriptLock();
      // Two guests submitting at the same second would otherwise interleave
      // their appends and corrupt a row.
      lock.waitLock(20_000);
      try {
        return fn();
      } finally {
        lock.releaseLock();
      }
    },
    renderEmail: renderConfirmationEmail,
    log: (message) => console.error(message),
  };
}

/**
 * Apps Script cannot set response headers and answers POST with a 302, so any
 * request that triggers a CORS preflight fails. ContentService responses carry
 * `Access-Control-Allow-Origin: *` already; the client's side of the bargain is
 * to send `text/plain` and no custom headers.
 */
function json(body: unknown) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

export function doGet(e: { parameter?: Record<string, string> }) {
  try {
    return json(dispatchGet(buildDeps(), e?.parameter ?? {}));
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: 'SERVER_ERROR' });
  }
}

export function doPost(e: { postData?: { contents?: string } }) {
  try {
    const body = JSON.parse(e?.postData?.contents ?? '{}');
    return json(dispatchPost(buildDeps(), body));
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: 'SERVER_ERROR' });
  }
}

// ---------------------------------------------------------------------------
// Spreadsheet menu
// ---------------------------------------------------------------------------

export function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Wedding')
    .addItem('Rebuild exports', 'rebuildExports')
    .addToUi();
}

/**
 * Regenerate the derived tabs on demand rather than on every write.
 *
 * Rebuilding on each submission would make every guest wait for work only the
 * couple ever look at, and a failure mid-rebuild could take a submission down
 * with it. This runs when they are about to talk to a vendor.
 */
export function rebuildExports() {
  const config = readConfig();
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const responses = book.getSheetByName(TABS.responses);
  if (!responses || responses.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('No responses yet.');
    return;
  }

  const values = responses
    .getRange(2, 1, responses.getLastRow() - 1, RESPONSE_COLUMNS.length)
    .getValues();
  const rows = values.map(parseResponseRow).filter(Boolean) as NonNullable<
    ReturnType<typeof parseResponseRow>
  >[];
  const coming = rows.filter((row) => row.payload.status === 'yes');

  const write = (name: string, headers: readonly string[], data: unknown[][]) => {
    let sheet = book.getSheetByName(name);
    if (!sheet) sheet = book.insertSheet(name);
    sheet.clear();
    sheet.appendRow([...headers]);
    if (data.length) sheet.getRange(2, 1, data.length, headers.length).setValues(
      data.map((row) => {
        const padded = [...row];
        while (padded.length < headers.length) padded.push('');
        return padded.slice(0, headers.length);
      }),
    );
    sheet.setFrozenRows(1);
  };

  write(TABS.attendees, ATTENDEE_COLUMNS, attendeeRows(coming));
  write(TABS.hotel, HOTEL_COLUMNS, hotelRows(coming));
  write(TABS.handoff, HANDOFF_COLUMNS, handoffRows(coming));

  const summary = cateringSummary(coming);
  let sheet = book.getSheetByName(TABS.catering);
  if (!sheet) sheet = book.insertSheet(TABS.catering);
  sheet.clear();
  if (summary.length) {
    const width = Math.max(...summary.map((r) => r.length));
    sheet.getRange(1, 1, summary.length, width).setValues(
      summary.map((r) => {
        const padded = [...r];
        while (padded.length < width) padded.push('');
        return padded;
      }),
    );
  }

  SpreadsheetApp.getUi().alert(
    `Rebuilt from ${rows.length} replies (${coming.length} coming).\n\n` +
      `HotelBlock and CateringHandoff are safe to send on — they carry no data ` +
      `the recipient should not have. Responses and Attendees are for you only.\n\n` +
      `Site: ${config.siteOrigin}`,
  );
}
