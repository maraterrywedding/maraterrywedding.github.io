/**
 * Confirmation email.
 *
 * Plain text on purpose. HTML mail from a consumer Gmail account is far more
 * likely to be filtered, and this message has exactly one job that must not
 * fail: deliver the edit link. It is written in the language the guest used.
 *
 * The link appears on its own line, unshortened, because it has to survive
 * being copied out of a mail client — and because a shortened link from an
 * unfamiliar domain is exactly what people have been taught not to click.
 */

import { editUrl, type BackendConfig, type PartyRow } from './handlers.ts';
import type { RsvpPayload } from '../../src/lib/rsvp/model.ts';

type Locale = 'en' | 'de' | 'pt';

interface Strings {
  subject: (couple: string) => string;
  greeting: (name: string) => string;
  introYes: string;
  introMaybe: string;
  introNo: string;
  coming: string;
  food: string;
  hotel: string;
  nights: string;
  code: string;
  codeHint: string;
  editHeading: string;
  editHint: string;
  deadline: (date: string) => string;
  changed: string;
  questions: string;
  signOff: string;
  diet: Record<string, string>;
}

const STRINGS: Record<Locale, Strings> = {
  en: {
    subject: (couple) => `Your RSVP for ${couple} — 11 June 2027`,
    greeting: (name) => `Hello ${name},`,
    introYes: "Thank you — you're on the list. Here's what we have for you:",
    introMaybe: "Thank you for letting us know. Here's what we have so far:",
    introNo: "Thank you for telling us — we'll miss you, and we'll raise a glass to you on the day.",
    coming: 'Coming',
    food: 'Food',
    hotel: 'Room',
    nights: 'nights',
    code: 'Your code for the day',
    codeHint: "We'll use this for seating and to find you when you arrive.",
    editHeading: 'To change anything, open this link:',
    editHint: "Keep this email — it's the only way back into your answer.",
    deadline: (date) => `You can make changes until ${date}.`,
    changed: 'If this change was not made by you, please reply to this email.',
    questions: 'Any questions at all, just reply — this reaches both of us.',
    signOff: 'With love,',
    diet: { meat: 'everything', vegetarian: 'vegetarian', vegan: 'vegan' },
  },
  de: {
    subject: (couple) => `Eure Zusage für ${couple} — 11. Juni 2027`,
    greeting: (name) => `Hallo ${name},`,
    introYes: 'Danke — ihr steht auf der Liste. Das haben wir notiert:',
    introMaybe: 'Danke für eure Rückmeldung. Das haben wir bisher notiert:',
    introNo:
      'Danke, dass ihr Bescheid gesagt habt — wir werden euch vermissen und stoßen am Tag auf euch an.',
    coming: 'Dabei',
    food: 'Essen',
    hotel: 'Zimmer',
    nights: 'Nächte',
    code: 'Euer Code für den Tag',
    codeHint: 'Damit ordnen wir die Sitzplätze zu und finden euch bei der Ankunft.',
    editHeading: 'Zum Ändern öffnet diesen Link:',
    editHint: 'Hebt diese E-Mail auf — nur darüber kommt ihr wieder an eure Antwort.',
    deadline: (date) => `Ändern könnt ihr bis zum ${date}.`,
    changed: 'Falls diese Änderung nicht von euch kam, antwortet bitte auf diese E-Mail.',
    questions: 'Bei Fragen einfach antworten — das erreicht uns beide.',
    signOff: 'Alles Liebe,',
    diet: { meat: 'alles', vegetarian: 'vegetarisch', vegan: 'vegan' },
  },
  pt: {
    subject: (couple) => `A confirmação de vocês para ${couple} — 11 de junho de 2027`,
    greeting: (name) => `Oi, ${name}!`,
    introYes: 'Obrigado — vocês estão na lista. Foi isto que anotamos:',
    introMaybe: 'Obrigado por avisar. Foi isto que anotamos até agora:',
    introNo:
      'Obrigado por contar para a gente — vamos sentir falta de vocês e vamos brindar a vocês no dia.',
    coming: 'Vêm',
    food: 'Comida',
    hotel: 'Quarto',
    nights: 'noites',
    code: 'O código de vocês para o dia',
    codeHint: 'Usamos ele para organizar as mesas e encontrar vocês na chegada.',
    editHeading: 'Para mudar qualquer coisa, abram este link:',
    editHint: 'Guardem este e-mail — é o único caminho de volta para a resposta de vocês.',
    deadline: (date) => `Dá para mudar até ${date}.`,
    changed: 'Se essa alteração não foi feita por vocês, respondam este e-mail.',
    questions: 'Qualquer dúvida, é só responder — chega para nós dois.',
    signOff: 'Com carinho,',
    diet: { meat: 'de tudo', vegetarian: 'vegetariano', vegan: 'vegano' },
  },
};

function localeOf(value: string): Locale {
  return value === 'de' || value === 'pt' ? value : 'en';
}

function formatDate(iso: string, locale: Locale): string {
  const tag = locale === 'de' ? 'de-DE' : locale === 'pt' ? 'pt-BR' : 'en-GB';
  return new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

/** A read-back of what they actually told us. People trust what they can see. */
function summarise(payload: RsvpPayload, s: Strings, locale: Locale): string[] {
  if (payload.status !== 'yes') return [];

  const lines: string[] = [];
  lines.push(`${s.coming}: ${payload.attendees.map((a) => a.fullName).join(', ')}`);

  const diets = payload.attendees
    .map((a) => {
      const bits = [s.diet[a.diet] ?? a.diet];
      if (a.lactoseFree) bits.push('lactose-free');
      if (a.allergens.length) bits.push(a.allergens.join(', '));
      if (a.allergenOther) bits.push(a.allergenOther);
      return `${a.fullName.split(' ')[0]}: ${bits.join(', ')}`;
    })
    .join(' | ');
  lines.push(`${s.food}: ${diets}`);

  if (payload.hotelStatus === 'yes') {
    const nights = payload.nights.map((n) => formatDate(n, locale)).join(', ');
    lines.push(`${s.hotel}: ${payload.roomsRequested ?? 1} (${payload.nights.length} ${s.nights}: ${nights})`);
  }

  return lines;
}

export function renderConfirmationEmail(
  row: PartyRow,
  config: BackendConfig,
): { subject: string; body: string } {
  const locale = localeOf(row.locale);
  const s = STRINGS[locale];
  const payload = row.payload;

  const intro =
    payload.status === 'yes' ? s.introYes : payload.status === 'maybe' ? s.introMaybe : s.introNo;

  const parts: string[] = [s.greeting(payload.leadFirstName), '', intro];

  const summary = summarise(payload, s, locale);
  if (summary.length) parts.push('', ...summary);

  if (payload.status !== 'no') {
    parts.push('', `${s.code}: ${row.partyCode}`, s.codeHint);
  }

  parts.push(
    '',
    s.editHeading,
    editUrl(row.token, row.locale, config.siteOrigin),
    '',
    s.editHint,
    s.deadline(formatDate(config.hardLock, locale)),
  );

  // Only on a change, so the first email does not sound like a security alert.
  if (row.version > 1) parts.push('', s.changed);

  parts.push('', s.questions, '', s.signOff, config.coupleNames);

  return { subject: s.subject(config.coupleNames), body: parts.join('\n') };
}
