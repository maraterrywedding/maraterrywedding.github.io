import type { Localized } from '@/i18n/utils';

/**
 * Dress codes only mean anything relative to each other, so the page shows a
 * ladder of four and highlights the couple's choice. Until they pick one,
 * `CHOSEN_CODE` stays null and the page says so plainly while still giving the
 * advice that is true whatever they choose — grass, June evenings by the river,
 * and the 17:00 window to change.
 */

export type DressLevel = 'smart-casual' | 'cocktail' | 'formal' | 'black-tie';

/** Set to one of the DressLevel values once the couple decide. */
export const CHOSEN_CODE: DressLevel | null = null;

export interface DressCode {
  id: DressLevel;
  name: Localized<string>;
  /** The five-word version most guests will read and nothing else. */
  gloss: Localized<string>;
  feminine: Localized<string>;
  masculine: Localized<string>;
  /** A familiar situation at the same level of dress. */
  likeGoingTo: Localized<string>;
}

export const DRESS_CODES: DressCode[] = [
  {
    id: 'smart-casual',
    name: { en: 'Smart casual', de: 'Smart casual', pt: 'Esporte fino' },
    gloss: {
      en: 'Neat, comfortable, no tie needed',
      de: 'Gepflegt, bequem, keine Krawatte nötig',
      pt: 'Arrumado, confortável, sem gravata',
    },
    feminine: {
      en: 'A nice dress, a skirt, or smart trousers. Flats are completely fine.',
      de: 'Ein schönes Kleid, ein Rock oder eine elegante Hose. Flache Schuhe sind völlig in Ordnung.',
      pt: 'Um vestido bonito, saia ou calça social. Sapatilha está ótimo.',
    },
    masculine: {
      en: 'Chinos and a shirt. A blazer if you like, no tie.',
      de: 'Chino und Hemd. Sakko, wenn ihr mögt, keine Krawatte.',
      pt: 'Calça de sarja e camisa. Blazer se quiser, sem gravata.',
    },
    likeGoingTo: {
      en: 'Sunday lunch with the in-laws',
      de: 'Sonntagsessen bei den Schwiegereltern',
      pt: 'Um almoço de domingo com os sogros',
    },
  },
  {
    id: 'cocktail',
    name: { en: 'Cocktail', de: 'Cocktail', pt: 'Cocktail' },
    gloss: {
      en: 'A nice dress or a suit — no tuxedo',
      de: 'Ein schönes Kleid oder ein Anzug — kein Smoking',
      pt: 'Um vestido bonito ou terno — sem smoking',
    },
    feminine: {
      en: 'A knee- or midi-length dress, or dressy separates. Heels or smart flats.',
      de: 'Ein knie- oder wadenlanges Kleid oder eine elegante Kombination. Absätze oder schicke flache Schuhe.',
      pt: 'Vestido na altura do joelho ou midi, ou conjunto elegante. Salto ou sapatilha bonita.',
    },
    masculine: {
      en: 'A suit in any colour, with a shirt. Tie optional.',
      de: 'Ein Anzug in beliebiger Farbe mit Hemd. Krawatte optional.',
      pt: 'Terno de qualquer cor, com camisa. Gravata é opcional.',
    },
    likeGoingTo: {
      en: 'A good restaurant in the evening',
      de: 'Ein gutes Restaurant am Abend',
      pt: 'Um bom restaurante à noite',
    },
  },
  {
    id: 'formal',
    name: {
      en: 'Formal',
      de: 'Festlich',
      pt: 'Formal',
    },
    gloss: {
      en: 'Dark suit, long or elegant dress',
      de: 'Dunkler Anzug, langes oder elegantes Kleid',
      pt: 'Terno escuro, vestido longo ou elegante',
    },
    feminine: {
      en: 'A long dress, or an elegant midi.',
      de: 'Ein langes Kleid oder ein elegantes Midikleid.',
      pt: 'Um vestido longo ou um midi elegante.',
    },
    masculine: {
      en: 'A dark suit or dinner jacket, with a tie.',
      de: 'Ein dunkler Anzug oder Dinnerjackett, mit Krawatte.',
      pt: 'Terno escuro ou paletó de jantar, com gravata.',
    },
    likeGoingTo: {
      en: 'An awards evening',
      de: 'Eine Preisverleihung',
      pt: 'Uma noite de premiação',
    },
  },
  {
    id: 'black-tie',
    name: { en: 'Black tie', de: 'Black Tie', pt: 'Black tie' },
    gloss: {
      en: 'Tuxedo and floor-length gown',
      de: 'Smoking und bodenlanges Abendkleid',
      pt: 'Smoking e vestido longo',
    },
    feminine: {
      en: 'A floor-length gown.',
      de: 'Ein bodenlanges Abendkleid.',
      pt: 'Um vestido longo até o chão.',
    },
    masculine: {
      en: 'A tuxedo with a bow tie.',
      de: 'Ein Smoking mit Fliege.',
      pt: 'Smoking com gravata-borboleta.',
    },
    likeGoingTo: {
      en: 'An opera premiere',
      de: 'Eine Opernpremiere',
      pt: 'Uma estreia na ópera',
    },
  },
];

/**
 * Advice that holds whatever code the couple land on. This is the part guests
 * actually need and that a generic dress-code page never gives them.
 */
export interface DressTip {
  id: string;
  icon: 'grass' | 'weather' | 'colour' | 'change' | 'kids';
  title: Localized<string>;
  body: Localized<string>;
}

export const DRESS_TIPS: DressTip[] = [
  {
    id: 'grass',
    icon: 'grass',
    title: {
      en: 'There will be grass and gravel',
      de: 'Es gibt Gras und Kies',
      pt: 'Vai ter grama e cascalho',
    },
    body: {
      en: 'Group photos, garden games and the walk along the Weser all happen outdoors. Stiletto heels will sink. Block heels, wedges and flats will not.',
      de: 'Gruppenfotos, Gartenspiele und der Spaziergang an der Weser finden draußen statt. Pfennigabsätze sinken ein. Blockabsätze, Keilabsätze und flache Schuhe nicht.',
      pt: 'As fotos em grupo, os jogos no jardim e a caminhada à beira do Weser são todos ao ar livre. Salto fino vai afundar. Salto grosso, anabela e sapatilha, não.',
    },
  },
  {
    id: 'weather',
    icon: 'weather',
    title: {
      en: 'Warm by day, cool by the river at night',
      de: 'Tagsüber warm, abends kühl am Fluss',
      pt: 'Quente de dia, fresco à beira do rio à noite',
    },
    body: {
      en: 'June in the Weser valley is usually pleasant in the afternoon and noticeably cooler once the sun goes down. Bring a layer for the evening.',
      de: 'Der Juni im Wesertal ist nachmittags meist angenehm und abends deutlich kühler. Nehmt etwas zum Überziehen mit.',
      pt: 'Junho no vale do Weser costuma ser agradável à tarde e bem mais fresco depois que o sol se põe. Levem um casaquinho para a noite.',
    },
  },
  {
    id: 'colour',
    icon: 'colour',
    title: {
      en: 'Please leave white to the bride',
      de: 'Weiß bitte der Braut überlassen',
      pt: 'Deixem o branco para a noiva',
    },
    body: {
      en: 'Nobody but the bride wears a white dress — and that includes ivory and cream. Everything else is open, and the more colour the better.',
      de: 'Außer der Braut trägt niemand ein weißes Kleid — Elfenbein und Creme zählen mit dazu. Alles andere ist offen, und je bunter, desto besser.',
      pt: 'Ninguém além da noiva usa vestido branco — marfim e creme contam também. O resto está liberado, e quanto mais cor, melhor.',
    },
  },
  {
    id: 'kids',
    icon: 'kids',
    title: { en: 'For the children', de: 'Für die Kinder', pt: 'Para as crianças' },
    body: {
      en: 'Comfortable and washable. They will be on the grass within ten minutes, and that is exactly as it should be.',
      de: 'Bequem und waschbar. Sie werden nach zehn Minuten im Gras sein, und genau so soll es sein.',
      pt: 'Confortável e lavável. Em dez minutos elas vão estar na grama, e é exatamente assim que tem que ser.',
    },
  },
];
