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

/**
 * Shows the "may still change" pill on the schedule page. Off now the couple
 * have confirmed the running order — the page intro says small changes may
 * still happen.
 */
export const SCHEDULE_IS_PROVISIONAL = false;

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
      en: 'Guest reception and seating accommodation',
      de: 'Empfang und Platzierung der Gäste',
      pt: 'Recepção dos convidados e acomodação nos lugares',
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
    time: '12:00',
    title: {
      en: 'Sekt reception and finger food',
      de: 'Sektempfang und Fingerfood',
      pt: 'Recepção com espumante e finger food',
    },
  },
  {
    time: '13:00',
    title: {
      en: 'Free time, photos, possible games, accompanied by Sekt, orange juice and beer',
      de: 'Freie Zeit, Fotos, eventuell Spiele, dazu Sekt, Orangensaft und Bier',
      pt: 'Tempo livre, fotos, talvez alguns jogos, com espumante, suco de laranja e cerveja',
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
      en: 'Speeches: best man, maid of honour, then the two of us',
      de: 'Reden: Trauzeuge, Trauzeugin, dann wir beide',
      pt: 'Discursos: padrinho, madrinha e depois nós dois',
    },
  },
  {
    time: '17:00',
    title: {
      en: 'Free time with drinks, photos and games',
      de: 'Freie Zeit mit Getränken, Fotos und Spielen',
      pt: 'Tempo livre com bebidas, fotos e jogos',
    },
  },
  {
    time: '18:00',
    highlight: true,
    title: {
      en: 'Dinner and party',
      de: 'Abendessen und Party',
      pt: 'Jantar e festa',
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
      en: 'Party continues',
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
      en: 'Start of closure',
      de: 'Beginn des Ausklangs',
      pt: 'Início do encerramento',
    },
  },
  {
    time: '01:00',
    nextDay: true,
    title: {
      en: 'Party ends and good night :)',
      de: 'Ende der Party und gute Nacht :)',
      pt: 'Fim da festa e boa noite :)',
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
