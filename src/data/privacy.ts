import type { Localized } from '@/i18n/utils';

/**
 * Privacy notice.
 *
 * Guests are largely in the EU, and the RSVP form collects dietary and allergy
 * information — which is special-category health data under Article 9 GDPR.
 * That is why the form asks for a separate, explicit consent for it, and why
 * the vendor hand-offs are redacted: the caterer gets diets without names and
 * contact details, the hotel gets rooms and nights without diets.
 *
 * The retention date below is a promise. It needs to be honoured by actually
 * deleting the sheet, so it is worth a calendar reminder.
 */

/** Bump when the wording changes materially; the RSVP form stamps this on each row. */
export const CONSENT_VERSION = '2026-08-14';

/** Everything is deleted by this date, including backups. */
export const DELETE_BY = '2027-09-30';

export interface PrivacySection {
  id: string;
  title: Localized<string>;
  body: Localized<string>;
  bullets?: Localized<string>[];
}

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'who',
    title: { en: 'Who is asking', de: 'Wer fragt', pt: 'Quem está pedindo' },
    body: {
      en: 'This is a private wedding website run by the two of us, Mara and Terry. There is no company behind it, no analytics, and nobody is being paid to look at your data. If you want to talk to a human about any of this, write to us directly.',
      de: 'Das ist eine private Hochzeitsseite, die wir beide betreiben — Mara und Terry. Dahinter steht keine Firma, es gibt keine Analyse-Tools, und niemand wird dafür bezahlt, sich eure Daten anzusehen. Wenn ihr mit einem Menschen darüber sprechen wollt, schreibt uns einfach.',
      pt: 'Este é um site de casamento particular, cuidado por nós dois, Mara e Terry. Não tem empresa por trás, não tem ferramenta de análise, e ninguém é pago para olhar os dados de vocês. Se quiserem falar com uma pessoa sobre isso, escrevam direto para nós.',
    },
  },
  {
    id: 'what',
    title: { en: 'What we collect', de: 'Was wir erheben', pt: 'O que coletamos' },
    body: {
      en: 'Only what you type into the RSVP form:',
      de: 'Nur das, was ihr ins Zusageformular eintragt:',
      pt: 'Só o que vocês digitarem no formulário de confirmação:',
    },
    bullets: [
      {
        en: 'Your name, and the name of everyone coming with you',
        de: 'Euren Namen und die Namen aller, die mitkommen',
        pt: 'Seu nome e o nome de todos que vêm com você',
      },
      {
        en: 'An email address and a phone number, so we can reach you',
        de: 'Eine E-Mail-Adresse und eine Telefonnummer, damit wir euch erreichen',
        pt: 'Um e-mail e um telefone, para conseguirmos falar com vocês',
      },
      {
        en: 'The age of any children, so the kitchen and the hotel can plan',
        de: 'Das Alter mitkommender Kinder, damit Küche und Hotel planen können',
        pt: 'A idade das crianças, para a cozinha e o hotel poderem se organizar',
      },
      {
        en: 'What each person eats, and any allergies',
        de: 'Was jede Person isst und etwaige Allergien',
        pt: 'O que cada pessoa come e eventuais alergias',
      },
      {
        en: 'Whether you want a room, and how you plan to travel',
        de: 'Ob ihr ein Zimmer möchtet und wie ihr anreist',
        pt: 'Se vocês querem quarto e como pretendem viajar',
      },
    ],
  },
  {
    id: 'why',
    title: { en: 'Why we need it', de: 'Warum wir das brauchen', pt: 'Por que precisamos disso' },
    body: {
      en: 'To plan a wedding, and nothing else: how many meals to order, who needs a vegan plate, how many rooms to hold, who needs a lift from the station, and where everyone sits.',
      de: 'Um eine Hochzeit zu planen, und für nichts anderes: wie viele Essen wir bestellen, wer einen veganen Teller braucht, wie viele Zimmer wir blocken, wer eine Mitfahrgelegenheit vom Bahnhof braucht und wer wo sitzt.',
      pt: 'Para organizar um casamento, e nada mais: quantos pratos pedir, quem precisa de opção vegana, quantos quartos reservar, quem precisa de carona da estação e onde cada um vai sentar.',
    },
  },
  {
    id: 'sensitive',
    title: {
      en: 'Food and allergy information gets extra care',
      de: 'Angaben zu Essen und Allergien behandeln wir besonders',
      pt: 'Informações de comida e alergia recebem cuidado extra',
    },
    body: {
      en: 'Under European data protection law, information about allergies and diet counts as health data and needs your explicit permission, separately from everything else. That is why the form asks twice. It is also why the caterer receives first names, ages and meal requirements but no surnames, email addresses or phone numbers — and why the hotel receives rooms and nights but nothing about what you eat.',
      de: 'Nach europäischem Datenschutzrecht gelten Angaben zu Allergien und Ernährung als Gesundheitsdaten und brauchen eure ausdrückliche Zustimmung, getrennt von allem anderen. Deshalb fragt das Formular zweimal. Und deshalb erhält der Caterer Vornamen, Alter und Essenswünsche, aber keine Nachnamen, E-Mail-Adressen oder Telefonnummern — und das Hotel erfährt Zimmer und Nächte, aber nichts darüber, was ihr isst.',
      pt: 'Pela lei europeia de proteção de dados, informação sobre alergia e alimentação conta como dado de saúde e precisa da sua autorização explícita, separada de tudo o mais. É por isso que o formulário pergunta duas vezes. E é por isso que o bufê recebe primeiros nomes, idades e restrições alimentares, mas nenhum sobrenome, e-mail ou telefone — e o hotel recebe quartos e noites, mas nada sobre o que vocês comem.',
    },
  },
  {
    id: 'who-sees',
    title: { en: 'Who sees it', de: 'Wer es sieht', pt: 'Quem vê' },
    body: {
      en: 'The two of us, and then only the specific slices listed above go to the caterer and the hotel. Your answers are stored in a private spreadsheet that only we can open. Nothing you submit is ever displayed on this website, and there is no guest list anybody can browse.',
      de: 'Wir beide — und darüber hinaus gehen nur die oben genannten Ausschnitte an Caterer und Hotel. Eure Angaben liegen in einer privaten Tabelle, die nur wir öffnen können. Nichts davon erscheint auf dieser Website, und es gibt keine Gästeliste, in der jemand blättern kann.',
      pt: 'Nós dois — e, além disso, só os pedaços específicos listados acima vão para o bufê e o hotel. As respostas ficam em uma planilha privada que só nós conseguimos abrir. Nada do que vocês enviarem aparece neste site, e não existe lista de convidados que alguém possa ficar folheando.',
    },
  },
  {
    id: 'no-cookies',
    title: { en: 'No cookies, no tracking', de: 'Keine Cookies, kein Tracking', pt: 'Sem cookies, sem rastreamento' },
    body: {
      en: 'This site sets no cookies and runs no analytics, which is why you were never asked to dismiss a banner. We do not log your IP address. Your language choice is remembered in your own browser and never leaves it.',
      de: 'Diese Seite setzt keine Cookies und nutzt keine Analyse-Tools — deshalb musstet ihr auch kein Banner wegklicken. Wir speichern eure IP-Adresse nicht. Eure Sprachwahl merkt sich euer eigener Browser und verlässt ihn nie.',
      pt: 'Este site não usa cookies nem ferramentas de análise — é por isso que ninguém pediu para vocês fecharem um aviso. Não guardamos o IP de vocês. A escolha de idioma fica no navegador de vocês e nunca sai de lá.',
    },
  },
  {
    id: 'how-long',
    title: { en: 'How long we keep it', de: 'Wie lange wir es behalten', pt: 'Por quanto tempo guardamos' },
    body: {
      en: 'Everything is deleted by 30 September 2027 — a few months after the wedding, once the last invoice is settled. That includes the spreadsheet and its backups.',
      de: 'Alles wird bis zum 30. September 2027 gelöscht — wenige Monate nach der Hochzeit, sobald die letzte Rechnung bezahlt ist. Das gilt auch für die Tabelle und ihre Sicherungskopien.',
      pt: 'Tudo é apagado até 30 de setembro de 2027 — alguns meses depois do casamento, quando a última conta estiver quitada. Isso inclui a planilha e as cópias de segurança.',
    },
  },
  {
    id: 'rights',
    title: { en: 'What you can ask for', de: 'Was ihr verlangen könnt', pt: 'O que vocês podem pedir' },
    body: {
      en: 'You can see what we hold, correct it yourself at any time using the edit link we email you, or ask us to delete it. You can withdraw your permission whenever you like — though if you withdraw the food and allergy part, we will not be able to cater for you properly. You also have the right to complain to a data protection authority.',
      de: 'Ihr könnt sehen, was wir gespeichert haben, es jederzeit selbst über den Bearbeitungslink aus unserer E-Mail korrigieren oder uns bitten, es zu löschen. Ihr könnt eure Zustimmung jederzeit zurückziehen — wenn ihr allerdings den Teil zu Essen und Allergien zurückzieht, können wir euch nicht richtig verpflegen. Ihr habt außerdem das Recht, sich bei einer Datenschutzbehörde zu beschweren.',
      pt: 'Vocês podem ver o que temos, corrigir por conta própria a qualquer momento pelo link de edição que enviamos por e-mail, ou pedir para apagarmos. Podem retirar a autorização quando quiserem — mas, se retirarem a parte de comida e alergia, não vamos conseguir organizar a refeição de vocês direito. Vocês também têm o direito de reclamar a uma autoridade de proteção de dados.',
    },
  },
];
