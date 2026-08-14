/**
 * A local stand-in for the deployed Google Apps Script backend.
 *
 * It does NOT reimplement the backend — it imports the real handlers and runs
 * them against an in-memory sheet and a console mailer. An earlier version of
 * this file hand-rolled the responses and quietly drifted out of step: it never
 * validated a payload and never returned a party code, so the end-to-end tests
 * were passing against a weaker contract than production. Reusing the handlers
 * makes that impossible.
 *
 * It still enforces the awkward parts of the Apps Script contract on purpose:
 *  - POST bodies must be `text/plain`; anything else is rejected, because Apps
 *    Script cannot answer a CORS preflight and a JSON body would work here and
 *    fail in production.
 *  - A preflight request is answered with 405 rather than accommodated, so a
 *    client that triggers one fails loudly and locally.
 *
 * Run: npm run dev:api    (http://localhost:8788)
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  dispatchGet,
  dispatchPost,
  type BackendConfig,
  type Deps,
  type PartyRow,
  type SheetPort,
  type SubmissionEntry,
} from '../gas/src/handlers.ts';
import { renderConfirmationEmail } from '../gas/src/mail.ts';

const PORT = Number(process.env.MOCK_RSVP_PORT ?? 8788);

/** Overridable so a test can drive the server into the late or locked phase. */
const CONFIG: BackendConfig = {
  softDeadline: process.env.MOCK_SOFT_DEADLINE ?? '2026-11-05T23:59:59+01:00',
  hardLock: process.env.MOCK_HARD_LOCK ?? '2026-12-15T23:59:59+01:00',
  eventAt: '2027-06-11T11:00:00+02:00',
  hotelNights: ['2027-06-10', '2027-06-11', '2027-06-12'],
  inviteCode: 'GROHNDE27',
  siteOrigin: process.env.MOCK_SITE_ORIGIN ?? 'http://localhost:4321',
  replyTo: 'maraterrywedding@gmail.com',
  coupleNames: 'Mara & Terry',
};

const rows: PartyRow[] = [];
const submissions: SubmissionEntry[] = [];

const sheet: SheetPort = {
  findByToken: (token) => rows.find((r) => r.token === token) ?? null,
  findByEmail: (email) => rows.find((r) => r.email === email) ?? null,
  allNames: () =>
    rows.flatMap((r) => r.payload.attendees.map((a) => ({ token: r.token, name: a.fullName }))),
  insert: (row) => {
    rows.push(row);
  },
  update: (row) => {
    const i = rows.findIndex((r) => r.token === row.token);
    if (i >= 0) rows[i] = row;
  },
  appendSubmission: (entry) => {
    submissions.push(entry);
  },
};

const deps: Deps = {
  sheet,
  mailer: {
    send({ to, subject, body }) {
      // The link is the whole point of the email, so print it where you can see it.
      const link = body.split('\n').find((line) => line.startsWith('http')) ?? '(no link)';
      console.log(`\n  ✉  to ${to}`);
      console.log(`     ${subject}`);
      console.log(`     ${link}\n`);
    },
  },
  config: () => CONFIG,
  now: () => new Date(),
  uuid: () => randomUUID(),
  lock: (fn) => fn(),
  renderEmail: renderConfirmationEmail,
  log: (message) => console.error(`  ! ${message}`),
};

function send(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    // Matches what ContentService sends.
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    console.warn('  ✗ preflight received — the client is sending a non-simple request');
    res.writeHead(405, { 'Access-Control-Allow-Origin': '*' });
    res.end();
    return;
  }

  if (req.method === 'GET') {
    const params = Object.fromEntries(url.searchParams.entries());
    const result = dispatchGet(deps, params);
    return send(res, 200, result);
  }

  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

  if ((req.headers['content-type'] ?? '').includes('application/json')) {
    console.warn('  ✗ application/json would trigger a CORS preflight in production');
    return send(res, 400, { ok: false, error: 'USE_TEXT_PLAIN' });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return send(res, 200, { ok: false, error: 'BAD_JSON' });
  }

  const result = dispatchPost(deps, body);

  if (result.ok && body.action === 'create' && !result.duplicate) {
    const row = rows.at(-1);
    if (row?.payload.inviteCodeValid === false) {
      console.log(`  ⚠ no valid invitation code (typed "${row.payload.inviteCode}") — flagged`);
    }
  }

  return send(res, 200, result);
});

server.listen(PORT, () => {
  console.log(`Mock RSVP backend on http://localhost:${PORT}`);
  console.log('  running the real gas/src/handlers.ts against an in-memory sheet');
  console.log(`  soft ${CONFIG.softDeadline}  hard ${CONFIG.hardLock}`);
  console.log('  in-memory only — restarting clears every submission\n');
});
