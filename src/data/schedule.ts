import type { Localized } from '@/i18n/utils';

/**
 * The plan for the day.
 *
 * Times are absolute rather than offsets from the ceremony. If the ceremony
 * moves from 11:00 to 13:00 the whole day does NOT simply shift by two hours —
 * dinner will not move to 20:00 — so the times have to be re-decided by hand
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
    highlight: true,
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
    time: '11:50',
    title: { en: 'Sekt reception', de: 'Sektempfang', pt: 'Recepção com espumante' },
    note: {
      en: 'The first toast of the day — after the ceremony, not before.',
      de: 'Der erste Anstoß des Tages — nach der Trauung, nicht davor.',
      pt: 'O primeiro brinde do dia — depois da cerimônia, não antes.',
    },
  },
  {
    time: '12:30',
    title: { en: 'Lunch and finger food', de: 'Essen und Fingerfood', pt: 'Almoço e finger food' },
  },
  {
    time: '13:00',
    until: '14:00',
    title: {
      en: 'Free time — photos, a walk along the Weser, garden games',
      de: 'Freie Zeit — Fotos, Spaziergang an der Weser, Gartenspiele',
      pt: 'Tempo livre — fotos, caminhada à beira do Weser, jogos no jardim',
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
    time: '16:15',
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
      en: 'Quiet hour',
      de: 'Ruhestunde',
      pt: 'Hora do sossego',
    },
    note: {
      en: 'A breather: little ones can nap, everyone can change and catch their breath.',
      de: 'Eine Pause: Die Kleinen können schlafen, alle können sich umziehen und einmal durchatmen.',
      pt: 'Uma pausa: as crianças podem dormir, todo mundo pode se trocar e respirar um pouco.',
    },
  },
  {
    // TODO: this now collides with the 17:00 quiet hour. Two things cannot both
    // start at 17:00 — one of the two needs to move before this is final.
    time: '17:00',
    highlight: true,
    title: {
      en: 'Dinner, first dance, and the party',
      de: 'Abendessen, Eröffnungstanz und Party',
      pt: 'Jantar, primeira dança e festa',
    },
  },
  {
    time: '23:00',
    until: '23:30',
    title: {
      en: 'Midnight snack, and goodnight',
      de: 'Mitternachtssnack und gute Nacht',
      pt: 'Lanche da madrugada e boa noite',
    },
  },
];

/** What guests see: everything except the vendor logistics. */
export const guestSchedule = (): ScheduleEntry[] => SCHEDULE.filter((entry) => !entry.internal);
