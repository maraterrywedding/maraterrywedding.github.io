import type { Localized } from '@/i18n/utils';

/**
 * How to reach Grohnde.
 *
 * Everything here is marked provisional and no live departure time is stated as
 * fact — timetables for June 2027 do not exist yet, and a wrong train time on a
 * wedding website is worse than no train time. Journey durations are described
 * as approximate and every rail entry points guests at bahn.de to check.
 *
 * The single most useful fact for guests: Emmerthal has its own station on the
 * S5, which runs directly from Hannover Airport. Most people arriving by air
 * can get here without changing trains.
 */

export type TravelMode = 'air' | 'rail' | 'car' | 'taxi';

export interface TravelRoute {
  id: string;
  mode: TravelMode;
  from: Localized<string>;
  /** Approximate journey time, phrased loosely on purpose. */
  duration: Localized<string> | null;
  body: Localized<string>;
  link?: { href: string; label: Localized<string> };
}

export const NEAREST_STATION = {
  name: 'Emmerthal',
  line: 'S5',
  /** Approximate road distance from the station to the venue. */
  kmToVenue: 5,
};

export const TRAVEL_ROUTES: TravelRoute[] = [
  {
    id: 'hannover-air',
    mode: 'air',
    from: {
      en: 'Hannover Airport (HAJ)',
      de: 'Flughafen Hannover (HAJ)',
      pt: 'Aeroporto de Hannover (HAJ)',
    },
    duration: {
      en: 'about 1¼ hours by train, or an hour by car',
      de: 'etwa 1¼ Stunden mit der Bahn, rund eine Stunde mit dem Auto',
      pt: 'cerca de 1h15 de trem, ou uma hora de carro',
    },
    body: {
      en: 'This is the closest airport and by far the easiest arrival. The S5 train leaves from the airport station and runs roughly once an hour all the way to Emmerthal, so for most people there is no change of train at all.',
      de: 'Das ist der nächstgelegene Flughafen und mit Abstand die einfachste Anreise. Die S5 fährt vom Flughafenbahnhof etwa stündlich bis nach Emmerthal — für die meisten also ganz ohne Umsteigen.',
      pt: 'É o aeroporto mais próximo e, de longe, a chegada mais fácil. O trem S5 sai da estação do aeroporto mais ou menos de hora em hora e vai direto até Emmerthal — para a maioria, sem nenhuma baldeação.',
    },
  },
  {
    id: 'other-airports',
    mode: 'air',
    from: {
      en: 'Frankfurt, Düsseldorf or Berlin',
      de: 'Frankfurt, Düsseldorf oder Berlin',
      pt: 'Frankfurt, Düsseldorf ou Berlim',
    },
    duration: {
      en: 'roughly 3 to 5 hours onward by train',
      de: 'etwa 3 bis 5 Stunden Weiterreise mit der Bahn',
      pt: 'mais ou menos 3 a 5 horas de trem depois',
    },
    body: {
      en: 'If you are flying in from further afield, these are the usual long-haul gateways. Take a fast train to Hannover Hauptbahnhof first, then join the S5 towards Hameln and Emmerthal.',
      de: 'Wer von weiter weg anreist, landet meist an einem dieser Flughäfen. Nehmt zuerst einen Fernzug nach Hannover Hauptbahnhof und dort die S5 Richtung Hameln und Emmerthal.',
      pt: 'Quem vem de mais longe costuma chegar por um desses aeroportos. Peguem primeiro um trem rápido até a estação central de Hannover e depois a S5 no sentido Hameln e Emmerthal.',
    },
  },
  {
    id: 'rail',
    mode: 'rail',
    from: {
      en: 'By train, to Emmerthal',
      de: 'Mit der Bahn nach Emmerthal',
      pt: 'De trem, até Emmerthal',
    },
    duration: null,
    body: {
      en: 'Emmerthal is on the S5 line between Hannover and Paderborn, calling at Hameln and Bad Pyrmont on the way. The station is a small one — there is no ticket office, so buy before you travel or use the DB app. From the station it is about a ten-minute taxi ride to the venue.',
      de: 'Emmerthal liegt an der S5 zwischen Hannover und Paderborn, über Hameln und Bad Pyrmont. Der Bahnhof ist klein und hat keinen Schalter — kauft die Fahrkarte also vorher oder über die DB-App. Vom Bahnhof sind es etwa zehn Minuten mit dem Taxi bis zur Location.',
      pt: 'Emmerthal fica na linha S5 entre Hannover e Paderborn, passando por Hameln e Bad Pyrmont. A estação é pequena e não tem bilheteria — comprem a passagem antes ou pelo aplicativo da DB. Da estação até o local são uns dez minutos de táxi.',
    },
    link: {
      href: 'https://www.bahn.de/',
      label: {
        en: 'Check times on bahn.de',
        de: 'Verbindungen auf bahn.de prüfen',
        pt: 'Ver horários no bahn.de',
      },
    },
  },
  {
    id: 'car',
    mode: 'car',
    from: { en: 'By car', de: 'Mit dem Auto', pt: 'De carro' },
    duration: {
      en: 'about an hour from Hannover, 15 minutes from Hameln',
      de: 'etwa eine Stunde ab Hannover, 15 Minuten ab Hameln',
      pt: 'cerca de uma hora de Hannover, 15 minutos de Hameln',
    },
    body: {
      en: 'The venue has its own free parking. Grohnde sits right on the river, and the last stretch is a pretty country road — allow a few extra minutes and enjoy it. If you are staying over, leaving the car overnight is no problem.',
      de: 'Die Location hat eigene kostenlose Parkplätze. Grohnde liegt direkt am Fluss, und das letzte Stück ist eine schöne Landstraße — plant ein paar Minuten extra ein und genießt es. Wer übernachtet, kann das Auto problemlos stehen lassen.',
      pt: 'O local tem estacionamento próprio e gratuito. Grohnde fica bem na beira do rio, e o último trecho é uma estradinha bonita — reservem alguns minutos a mais e aproveitem. Quem for dormir por lá pode deixar o carro sem problema.',
    },
  },
  {
    id: 'taxi',
    mode: 'taxi',
    from: {
      en: 'The last few kilometres',
      de: 'Die letzten Kilometer',
      pt: 'Os últimos quilômetros',
    },
    duration: null,
    body: {
      en: 'This is the countryside, so taxis do not simply wait outside the station and there is no ride-hailing app worth relying on. Book one in advance for both directions, especially late at night. If you would rather share a car with someone else coming the same way, say so in your RSVP and we will put you in touch.',
      de: 'Hier ist Land — Taxis stehen nicht einfach am Bahnhof, und auf Fahrdienst-Apps ist kein Verlass. Bestellt für beide Richtungen vorher, besonders spät nachts. Wer lieber mit anderen mitfährt, sagt uns in der Zusage Bescheid — wir stellen den Kontakt her.',
      pt: 'Aqui é interior: táxis não ficam esperando na estação e não dá para contar com aplicativo de corrida. Reservem com antecedência para a ida e a volta, principalmente de madrugada. Se preferirem dividir carona com alguém que vem pelo mesmo caminho, avisem na confirmação de presença que a gente conecta vocês.',
    },
  },
];
