import type { Localized } from '@/i18n/utils';

/**
 * The plan for the day.
 *
 * Times are absolute rather than offsets from the ceremony. If the ceremony
 * moves from 11:00 to 13:00 the whole day does NOT simply shift by two hours —
 * dinner will not move to 21:00 — so the times have to be re-decided by hand
 * rather than recomputed. The `provisional` flag below keeps that honest to
 * guests in the meantime.
 *
 * Entries marked `internal` are vendor logistics, not guest information, and
 * are filtered out of every guest-facing view. They stay here so the couple
 * have one complete list, and so making one public later is a one-word edit.
 */

export interface ScheduleEntry {
  /** 24-hour local time at the venue. */
  time: string;
  /** For entries that span a window, e.g. free time. */
  until?: string;
  /**
   * The party runs past midnight, so `00:00` comes after `23:00` rather than
   * fourteen hours before it. Sorting and any arithmetic on `time` has to add
   * a day for these, which is why the flag exists rather than a `24:00` hack —
   * `24:00` is not a time any formatter or `<time datetime>` will accept.
   */
  nextDay?: boolean;
  title: Localized<string>;
  note?: Localized<string>;
  /** Vendor logistics — hidden from guests. */
  internal?: boolean;
  /** A visual marker for the two or three moments that anchor the day. */
  highlight?: boolean;
}

/** The whole schedule is still a draft; flip this when the couple confirm it. */
export const SCHEDULE_IS_PROVISIONAL = true;

export const SCHEDULE: ScheduleEntry[] = [
  {
    time: '10:00',
    internal: true,
    title: {
      en: 'Decorating access begins',
      de: 'Zugang zum Dekorieren',
      pt: 'Liberação para decoração',
    },
  },
  {
    time: '10:30',
    title: {
      en: 'Guests arrive',
      de: 'Ankunft der Gäste',
      pt: 'Chegada dos convidados',
    },
    note: {
      en: 'Please be seated by 10:50. There will be water out for you — the Sekt comes after the ceremony.',
      de: 'Bitte nehmt bis 10:50 Uhr Platz. Wasser steht für euch bereit — der Sekt kommt nach der Trauung.',
      pt: 'Por favor, sentem-se até as 10:50. Vai ter água à disposição — o espumante vem depois da cerimônia.',
    },
  },
  {
    time: '11:00',
    highlight: true,
    title: {
      en: 'Civil ceremony and registration',
      de: 'Standesamtliche Trauung',
      pt: 'Cerimônia civil e registro',
    },
  },
  {
    time: '11:40',
    title: {
      en: 'Congratulations, and a group photo of everyone',
      de: 'Gratulation und Gruppenfoto mit allen',
      pt: 'Cumprimentos e foto com todo mundo',
    },
    note: {
      en: 'Please stay close by for this one — we would love everybody in the picture.',
      de: 'Bleibt dafür bitte in der Nähe — wir hätten gern wirklich alle auf dem Bild.',
      pt: 'Fiquem por perto nesse momento — queremos todo mundo na foto.',
    },
  },
  {
    time: '12:00',
    title: {
      en: 'Sekt reception and finger food',
      de: 'Sektempfang und Fingerfood',
      pt: 'Recepção com espumante e finger food',
    },
    note: {
      en: 'The first toast of the day — after the ceremony, not before.',
      de: 'Der erste Anstoß des Tages — nach der Trauung, nicht davor.',
      pt: 'O primeiro brinde do dia — depois da cerimônia, não antes.',
    },
  },
  {
    time: '13:00',
    until: '15:00',
    title: {
      en: 'Free time — photos, a walk along the Weser, garden games',
      de: 'Freie Zeit — Fotos, Spaziergang an der Weser, Gartenspiele',
      pt: 'Tempo livre — fotos, caminhada à beira do Weser, jogos no jardim',
    },
    note: {
      en: 'Sekt, orange juice and beer are out for whoever would like one.',
      de: 'Sekt, Orangensaft und Bier stehen bereit, für alle, die mögen.',
      pt: 'Tem espumante, suco de laranja e cerveja à disposição de quem quiser.',
    },
  },
  {
    time: '15:00',
    title: {
      en: 'Coffee and cake',
      de: 'Kaffee und Kuchen',
      pt: 'Café e bolo',
    },
  },
  {
    time: '16:00',
    internal: true,
    title: {
      en: 'Eight-hour photography package window opens',
      de: 'Beginn des 8-Stunden-Fotopakets',
      pt: 'Início da janela do pacote de 8 horas de fotografia',
    },
  },
  {
    time: '16:00',
    highlight: true,
    title: {
      en: 'Speeches',
      de: 'Reden',
      pt: 'Discursos',
    },
    note: {
      en: 'Best man, then maid of honour, then the two of us.',
      de: 'Trauzeuge, dann Trauzeugin, dann wir beide.',
      pt: 'Padrinho, depois madrinha, e então nós dois.',
    },
  },
  {
    time: '17:00',
    title: {
      en: 'More free time — drinks, photos and games',
      de: 'Noch einmal freie Zeit — Getränke, Fotos und Spiele',
      pt: 'Mais tempo livre — bebidas, fotos e jogos',
    },
  },
  {
    time: '18:00',
    highlight: true,
    title: {
      en: 'Dinner, and the party begins',
      de: 'Abendessen, und die Party beginnt',
      pt: 'Jantar, e a festa começa',
    },
  },
  {
    time: '20:00',
    highlight: true,
    title: {
      en: 'First dance',
      de: 'Eröffnungstanz',
      pt: 'Primeira dança',
    },
  },
  {
    time: '21:00',
    title: {
      en: 'The party carries on',
      de: 'Die Party geht weiter',
      pt: 'A festa continua',
    },
  },
  {
    time: '23:00',
    title: {
      en: 'Midnight snacks',
      de: 'Mitternachtssnack',
      pt: 'Lanche da madrugada',
    },
  },
  {
    time: '00:00',
    nextDay: true,
    title: {
      en: 'The evening starts winding down',
      de: 'Der Abend klingt langsam aus',
      pt: 'A noite começa a se encerrar',
    },
  },
  {
    time: '01:00',
    nextDay: true,
    title: {
      en: 'The party ends, and goodnight',
      de: 'Die Party endet — gute Nacht',
      pt: 'A festa termina, e boa noite',
    },
  },
];

/** What guests see: everything except the vendor logistics. */
export const guestSchedule = (): ScheduleEntry[] => SCHEDULE.filter((entry) => !entry.internal);

/**
 * Minutes from the start of the wedding day, so entries after midnight sort
 * after the ones before it rather than jumping to the top.
 */
export const scheduleMinutes = (entry: ScheduleEntry): number => {
  const [hours, minutes] = entry.time.split(':').map(Number);
  return hours! * 60 + minutes! + (entry.nextDay ? 24 * 60 : 0);
};
