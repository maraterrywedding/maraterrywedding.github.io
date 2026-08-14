/**
 * Photos referenced by meaning rather than by filename, so swapping a picture
 * is a one-line change here and never a hunt through templates.
 *
 * Filenames come from `scripts/prep-photos.mjs` and are derived from the source
 * photo's own name, so adding a new photo never renumbers an existing one.
 *
 * Alt text is trilingual and lives with the image. It describes what is in the
 * picture for someone who cannot see it — it is not a caption.
 *
 * NOTE on the venue images: these came from the Grohnder Fährhaus website.
 * Using them to show guests where they are going is ordinary practice, but
 * before launch it is worth a quick email asking the hotel's permission, or
 * replacing them with photos taken on a site visit.
 */

import type { Localized } from '@/i18n/utils';

import newYears from '@/assets/photos/couple/couple-mara-terry-newsyears.jpg';
import vineyard from '@/assets/photos/couple/couple-20260719-164531394.jpg';
import river from '@/assets/photos/couple/couple-20260721-103009866-mp.jpg';
import valleyView from '@/assets/photos/couple/couple-20260720-053354390.jpg';
import hilltop from '@/assets/photos/couple/couple-20220812-124746029.jpg';
import overlook from '@/assets/photos/couple/couple-20220812-124501688.jpg';
import autumn from '@/assets/photos/couple/couple-20240923-065339470.jpg';
import rapeseed from '@/assets/photos/couple/couple-20250419-181016047.jpg';
import fields from '@/assets/photos/couple/couple-20250420-125742944.jpg';
import closeUp from '@/assets/photos/couple/couple-20250811-191732576.jpg';
import promenade from '@/assets/photos/couple/couple-20250811-192943751.jpg';
import beach from '@/assets/photos/couple/couple-20250815-133306003.jpg';
import indoors from '@/assets/photos/couple/couple-20250101-wa0014.jpg';
import venueEntrance from '@/assets/photos/venue/venue-2026-08-14-083119.jpg';
import venueFromRiver from '@/assets/photos/venue/venue-2026-08-14-083132.jpg';
import venueSunset from '@/assets/photos/venue/venue-2026-08-14-083210.jpg';

export interface Photo {
  src: ImageMetadata;
  alt: Localized<string>;
}

const photo = (src: ImageMetadata, alt: Localized<string>): Photo => ({ src, alt });

export const PHOTOS = {
  /** Home page hero — chosen by the couple. */
  hero: photo(newYears, {
    en: 'Mara and Terry at home, a kiss on the cheek and a laugh, with string lights glowing behind them.',
    de: 'Mara und Terry zu Hause, ein Kuss auf die Wange und ein Lachen, dahinter leuchtet eine Lichterkette.',
    pt: 'Mara e Terry em casa, um beijo no rosto e uma risada, com luzinhas brilhando ao fundo.',
  }),

  /** The previous hero. Still one of the best of the set. */
  coupleVineyard: photo(vineyard, {
    en: 'Mara and Terry smiling side by side, with vineyards and a green valley behind them.',
    de: 'Mara und Terry lächeln Seite an Seite, dahinter Weinberge und ein grünes Tal.',
    pt: 'Mara e Terry sorrindo lado a lado, com vinhedos e um vale verde ao fundo.',
  }),

  coupleRiver: photo(river, {
    en: 'Mara and Terry standing together beside a river on a bright summer day.',
    de: 'Mara und Terry stehen an einem hellen Sommertag zusammen an einem Fluss.',
    pt: 'Mara e Terry juntos à beira de um rio em um dia claro de verão.',
  }),

  /** No people — useful as a quiet band or on the travel page. */
  valleyView: photo(valleyView, {
    en: 'A wide view over a village and green fields from a hillside at dusk.',
    de: 'Weiter Blick von einem Hang über ein Dorf und grüne Felder in der Dämmerung.',
    pt: 'Vista ampla de uma encosta sobre um vilarejo e campos verdes ao anoitecer.',
  }),

  coupleHilltop: photo(hilltop, {
    en: 'Mara and Terry smiling on a hilltop above a green valley.',
    de: 'Mara und Terry lächeln auf einem Hügel über einem grünen Tal.',
    pt: 'Mara e Terry sorrindo no alto de uma colina sobre um vale verde.',
  }),

  coupleFields: photo(fields, {
    en: 'Mara and Terry outdoors with rolling fields and a wide sky behind them.',
    de: 'Mara und Terry im Freien, dahinter sanfte Felder und weiter Himmel.',
    pt: 'Mara e Terry ao ar livre, com campos ondulados e um céu amplo ao fundo.',
  }),

  coupleClose: photo(closeUp, {
    en: 'A close, happy moment between Mara and Terry by the water.',
    de: 'Ein enger, fröhlicher Moment zwischen Mara und Terry am Wasser.',
    pt: 'Um momento próximo e feliz entre Mara e Terry à beira da água.',
  }),

  couplePromenade: photo(promenade, {
    en: 'Mara and Terry on a waterfront promenade with mountains in the distance.',
    de: 'Mara und Terry auf einer Uferpromenade, in der Ferne Berge.',
    pt: 'Mara e Terry em um calçadão à beira-mar, com montanhas ao longe.',
  }),

  coupleBeach: photo(beach, {
    en: 'Mara and Terry on a beach on a clear day.',
    de: 'Mara und Terry an einem klaren Tag am Strand.',
    pt: 'Mara e Terry em uma praia em um dia claro.',
  }),

  coupleAutumn: photo(autumn, {
    en: 'Mara and Terry close together outdoors among trees.',
    de: 'Mara und Terry dicht beieinander draußen zwischen Bäumen.',
    pt: 'Mara e Terry juntinhos ao ar livre, entre árvores.',
  }),

  coupleIndoors: photo(indoors, {
    en: 'Mara and Terry at home, with string lights in the background.',
    de: 'Mara und Terry zu Hause, im Hintergrund eine Lichterkette.',
    pt: 'Mara e Terry em casa, com luzinhas ao fundo.',
  }),

  overlook: photo(overlook, {
    en: 'A view over a village and farmland from a hillside.',
    de: 'Blick von einem Hang über ein Dorf und Felder.',
    pt: 'Vista de uma encosta sobre um vilarejo e plantações.',
  }),

  rapeseed: photo(rapeseed, {
    en: 'Walking through a field of yellow flowers at sunset.',
    de: 'Spaziergang durch ein Feld gelber Blumen bei Sonnenuntergang.',
    pt: 'Caminhada por um campo de flores amarelas ao pôr do sol.',
  }),

  /** The Fährhaus from across the Weser, mirrored in the water — the best of the three. */
  venueFromRiver: photo(venueFromRiver, {
    en: 'The Grohnder Fährhaus seen from across the Weser, its wooden facade reflected in the water.',
    de: 'Das Grohnder Fährhaus von der anderen Weserseite, die Holzfassade spiegelt sich im Wasser.',
    pt: 'O Grohnder Fährhaus visto do outro lado do rio Weser, com a fachada de madeira refletida na água.',
  }),

  venueEntrance: photo(venueEntrance, {
    en: 'The front of the Grohnder Fährhaus, a long wooden building with flower-filled balconies.',
    de: 'Die Vorderseite des Grohnder Fährhauses, ein langes Holzgebäude mit blumengeschmückten Balkonen.',
    pt: 'A fachada do Grohnder Fährhaus, um longo prédio de madeira com sacadas floridas.',
  }),

  venueSunset: photo(venueSunset, {
    en: 'Sunset over the river Weser, with a wide orange sky above the water.',
    de: 'Sonnenuntergang über der Weser, ein weiter oranger Himmel über dem Wasser.',
    pt: 'Pôr do sol sobre o rio Weser, com um amplo céu alaranjado acima da água.',
  }),
} as const satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;
