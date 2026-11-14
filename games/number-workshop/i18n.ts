/**
 * EN/FR strings and number formatting for the number-workshop cartridge.
 * Pure module: no DOM access.
 */

import { createI18nResolver } from '../../src/core/i18n.js';
import type { FactsTheme } from './levels.js';

export type Lang = 'en' | 'fr';

/** Reduces any externally supplied locale to a language this cartridge ships. */
export function normalizeLocale(raw: unknown): Lang {
  if (typeof raw !== 'string') return 'en';
  const primary = raw.trim().toLowerCase().split('-')[0].split('_')[0];
  return primary === 'fr' ? 'fr' : 'en';
}

const formatters = new Map<Lang, Intl.NumberFormat>();

/** Locale-aware integer formatting: `60 000` in fr, `60,000` in en. */
export function formatNumber(n: number, locale: unknown): string {
  const lang = normalizeLocale(locale);
  let fmt = formatters.get(lang);
  if (!fmt) {
    fmt = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
    formatters.set(lang, fmt);
  }
  return fmt.format(n);
}

/** All numbers below arrive already formatted by `formatNumber`. */
export interface Dictionary {
  title: string;
  dividend: string;
  divisor: string;
  quotient: string;
  remainder: string;
  playAgain: string;
  check: string;
  dealOne: string;
  addGroup: string;
  removeGroup: string;
  leftOver: string;
  levelWord(index: string, total: string): string;
  noun(theme: FactsTheme, count: number): string;
  /** Sentence shown above the stage at ages 3-5 instead of an equation. */
  sharePrompt(n: string, theme: FactsTheme, plates: string, friends: boolean): string;
  shareLive(p: {
    plates: string;
    each: string | null;
    min: string;
    max: string;
    tray: string;
    theme: FactsTheme;
    friends: boolean;
  }): string;
  leftOverWhy(r: string, plates: string, theme: FactsTheme, friends: boolean): string;
  /** Left-over explanation in the array tier, where the child builds rows. */
  arrayLeftOver(r: string, b: string, theme: FactsTheme): string;
  /** Place-value column labels, thousands to units, six of them. */
  columns: readonly string[];
  slideBtn: string;
  slideBackBtn: string;
  stripLabel: string;
  tableLabel(value: string): string;
  shiftPrompt(a: string, b: string): string;
  /** Counter such as `÷10 × 2 = ÷100`; `n` slides and the divisor they equal. */
  shiftCounter(n: number, nText: string, divisor: string): string;
  shiftTooFew(b: string, need: string, needCount: number, made: string): string;
  shiftTooMany(b: string, need: string, needCount: number, made: string): string;
  shiftRefuse: string;
  keypadLabel: string;
  backspaceLabel: string;
  remainderPrompt: string;
  euclidPrompt(b: string): string;
  gapLeft(n: string): string;
  euclidTooFar(total: string, a: string): string;
  /** `gapMarked` is false at hard, where the gap is not drawn. */
  euclidFalse(a: string, gapMarked: boolean): string;
  euclidNotEuclidean(b: string): string;
  euclidNeedRemainder: string;
  /** Written equality of a solved euclid level: 78 = (8 × 9) + 6. */
  resultEuclid(a: string, b: string, q: string, r: string): string;
  plateLabel(index: string, count: string, friends: boolean): string;
  takeBackLabel(index: string, friends: boolean): string;
  trayLabel(count: string, theme: FactsTheme, left: boolean): string;
  arrayPrompt(n: string, b: string, theme: FactsTheme): string;
  arrayReadout(b: string, groups: string, total: string, symbolFree: boolean): string;
  hintTooMany: string;
  hintRoomForMore(b: string): string;
  /** Final written result of a level (equality, or a sentence when symbol-free). */
  resultEquality(a: string, b: string, q: string, r: string): string;
  resultSentence(q: string, theme: FactsTheme, friends: boolean, r: string): string;
  summary(levels: string, mistakesText: string): string;
  starsLabel(n: number): string;
  groupsLabel(b: string): string;
}

const EN_NOUNS: Record<FactsTheme, [string, string]> = {
  dates: ['date', 'dates'],
  apples: ['apple', 'apples'],
  marbles: ['marble', 'marbles'],
  stars: ['star', 'stars']
};
const FR_NOUNS: Record<FactsTheme, [string, string]> = {
  dates: ['datte', 'dattes'],
  apples: ['pomme', 'pommes'],
  marbles: ['bille', 'billes'],
  stars: ['étoile', 'étoiles']
};

export const DICTIONARY: Record<Lang, Dictionary> = {
  en: {
    title: 'Division Workshop',
    dividend: 'dividend',
    divisor: 'divisor',
    quotient: 'quotient',
    remainder: 'remainder',
    playAgain: 'Play again',
    check: 'Check',
    dealOne: 'Deal one to each',
    addGroup: '+ group',
    removeGroup: '− group',
    leftOver: 'left over',
    levelWord: (i, total) => `${i}/${total}`,
    noun: (theme, n) => EN_NOUNS[theme][n === 1 ? 0 : 1],
    sharePrompt: (n, theme, plates, friends) =>
      friends
        ? `Give each of the ${plates} friends the same number of ${EN_NOUNS[theme][1]}: ${n} to share.`
        : `Share the ${n} ${EN_NOUNS[theme][1]} equally between ${plates} plates.`,
    shareLive: ({ plates, each, min, max, tray, friends }) => {
      const who = friends ? 'friends' : 'plates';
      const left = `${tray} still to share`;
      if (each !== null) return `${plates} ${who}, ${each} each, ${left}.`;
      return `${plates} ${who}: some have ${min}, some have ${max}. ${left}.`;
    },
    leftOverWhy: (r, plates, theme, friends) =>
      `${r} ${EN_NOUNS[theme][r === '1' ? 0 : 1]} left over: fewer than ${plates} ${
        friends ? 'friends' : 'plates'
      }, so they cannot be shared equally.`,
    arrayLeftOver: (r, b, theme) =>
      `${r} ${EN_NOUNS[theme][r === '1' ? 0 : 1]} left over: fewer than ${b}, so they cannot make another row of ${b}.`,
    columns: ['HTh', 'TTh', 'Th', 'H', 'T', 'O'],
    slideBtn: '÷10 →',
    slideBackBtn: '← ×10',
    stripLabel: 'Digit strip: drag it right to divide by ten',
    tableLabel: (v) => `Place-value table showing ${v}`,
    shiftPrompt: (a, b) => `Slide the digits of ${a} to the right to divide by ${b}.`,
    shiftCounter: (n, nText, d) => (n === 0 ? 'no slides yet' : n === 1 ? '÷10' : `÷10 × ${nText} = ÷${d}`),
    shiftTooFew: (b, need, n, made) =>
      `÷${b} is ${need} ${n === 1 ? 'slide' : 'slides'}. You made ${made}: keep sliding.`,
    shiftTooMany: (b, need, n, made) =>
      `÷${b} is ${need} ${n === 1 ? 'slide' : 'slides'}. You made ${made}: slide some back.`,
    shiftRefuse: 'Only zeros can slide off the table. This strip stays here.',
    keypadLabel: 'Number keys',
    backspaceLabel: 'Delete last digit',
    remainderPrompt: 'Left over:',
    euclidPrompt: (b) => `Fit as many groups of ${b} as you can, then type what is left over.`,
    gapLeft: (n) => `${n} left in the gap`,
    euclidTooFar: (total, a) => `Too far: ${total} is more than ${a}. Take a group away.`,
    euclidFalse: (a, gapMarked) =>
      `The groups and the left-over do not add up to ${a}. ${gapMarked ? 'Count the gap again.' : 'Check your groups and your left-over.'}`,
    euclidNotEuclidean: (b) => `The equality is true, but you can still fit another group of ${b}.`,
    euclidNeedRemainder: 'Type what is left over, then check.',
    resultEuclid: (a, b, q, r) => `${a} = (${b} × ${q}) + ${r}`,
    plateLabel: (i, c, friends) =>
      `${friends ? 'Friend' : 'Plate'} ${i}: ${c}. Press to add one.`,
    takeBackLabel: (i, friends) => `Take one back from ${friends ? 'friend' : 'plate'} ${i}`,
    trayLabel: (c, theme, left) =>
      left ? `${c} left over` : `${c} ${EN_NOUNS[theme][c === '1' ? 0 : 1]} to share`,
    arrayPrompt: (n, b, theme) =>
      `Add rows of ${b} until you have used the ${n} ${EN_NOUNS[theme][1]} with no full row left.`,
    arrayReadout: (b, g, total, symbolFree) =>
      symbolFree ? `${g} rows of ${b} make ${total}` : `${b} × ${g} = ${total}`,
    hintTooMany: 'That is more than you have. Take a row away.',
    hintRoomForMore: (b) => `There is still room for another row of ${b}.`,
    resultEquality: (a, b, q, r) => (r === '0' ? `${a} ÷ ${b} = ${q}` : `${a} ÷ ${b} = ${q} r ${r}`),
    resultSentence: (q, theme, friends, r) =>
      `Each ${friends ? 'friend' : 'plate'} has ${q} ${EN_NOUNS[theme][q === '1' ? 0 : 1]}.${
        r === '0' ? '' : ` ${r} left over.`
      }`,
    summary: (levels, mistakesText) => `${levels} levels, ${mistakesText}`,
    starsLabel: (n) => `${n} out of 3 stars`,
    groupsLabel: (b) => `Rows of ${b}`
  },
  fr: {
    title: 'Atelier de division',
    dividend: 'dividende',
    divisor: 'diviseur',
    quotient: 'quotient',
    remainder: 'reste',
    playAgain: 'Rejouer',
    check: 'Vérifier',
    dealOne: 'En donner un à chacun',
    addGroup: '+ groupe',
    removeGroup: '− groupe',
    leftOver: 'qui restent',
    levelWord: (i, total) => `${i}/${total}`,
    noun: (theme, n) => FR_NOUNS[theme][n <= 1 ? 0 : 1],
    sharePrompt: (n, theme, plates, friends) =>
      friends
        ? `Donne à chacun des ${plates} amis le même nombre de ${FR_NOUNS[theme][1]} : ${n} à partager.`
        : `Partage les ${n} ${FR_NOUNS[theme][1]} équitablement entre ${plates} assiettes.`,
    shareLive: ({ plates, each, min, max, tray, friends }) => {
      const who = friends ? 'amis' : 'assiettes';
      const left = `${tray} à partager`;
      if (each !== null) return `${plates} ${who}, ${each} chacun, ${left}.`;
      return `${plates} ${who} : certains en ont ${min}, d’autres ${max}. ${left}.`;
    },
    leftOverWhy: (r, plates, theme, friends) =>
      `${r} ${FR_NOUNS[theme][r === '1' || r === '0' ? 0 : 1]} qui restent : moins que ${plates} ${
        friends ? 'amis' : 'assiettes'
      }, donc impossible de les partager équitablement.`,
    arrayLeftOver: (r, b, theme) =>
      `${r} ${FR_NOUNS[theme][r === '1' || r === '0' ? 0 : 1]} qui restent : moins que ${b}, donc pas assez pour une autre rangée de ${b}.`.replace(' : ', '\u202f: '),
    columns: ['CM', 'DM', 'UM', 'C', 'D', 'U'],
    slideBtn: '÷10 →',
    slideBackBtn: '← ×10',
    stripLabel: 'Bande de chiffres : fais-la glisser vers la droite pour diviser par dix',
    tableLabel: (v) => `Tableau de numération affichant ${v}`,
    shiftPrompt: (a, b) => `Fais glisser les chiffres de ${a} vers la droite pour diviser par ${b}.`,
    shiftCounter: (n, nText, d) => (n === 0 ? 'aucun glissement' : n === 1 ? '÷10' : `÷10 × ${nText} = ÷${d}`),
    shiftTooFew: (b, need, n, made) =>
      `÷${b} fait ${need} ${n === 1 ? 'glissement' : 'glissements'}. Tu en as fait ${made} : continue.`,
    shiftTooMany: (b, need, n, made) =>
      `÷${b} fait ${need} ${n === 1 ? 'glissement' : 'glissements'}. Tu en as fait ${made} : reviens en arrière.`,
    shiftRefuse: 'Seuls les zéros peuvent sortir du tableau. La bande reste ici.',
    keypadLabel: 'Touches numériques',
    backspaceLabel: 'Effacer le dernier chiffre',
    remainderPrompt: 'Reste :',
    euclidPrompt: (b) => `Place autant de groupes de ${b} que possible, puis tape ce qui reste.`,
    gapLeft: (n) => `${n} à combler`,
    euclidTooFar: (total, a) => `Trop loin : ${total} dépasse ${a}. Enlève un groupe.`,
    euclidFalse: (a, gapMarked) =>
      `Les groupes et le reste ne font pas ${a}. ${gapMarked ? 'Recompte l’écart.' : 'Vérifie tes groupes et ton reste.'}`,
    euclidNotEuclidean: (b) => `L’égalité est vraie, mais tu peux encore placer un groupe de ${b}.`,
    euclidNeedRemainder: 'Tape ce qui reste, puis vérifie.',
    resultEuclid: (a, b, q, r) => `${a} = (${b} × ${q}) + ${r}`,
    plateLabel: (i, c, friends) =>
      `${friends ? 'Ami' : 'Assiette'} ${i} : ${c}. Appuie pour en ajouter un.`,
    takeBackLabel: (i, friends) => `Reprendre un élément ${friends ? 'de l’ami' : 'de l’assiette'} ${i}`,
    trayLabel: (c, theme, left) =>
      left
        ? `${c} qui restent`
        : `${c} ${FR_NOUNS[theme][c === '1' || c === '0' ? 0 : 1]} à partager`,
    arrayPrompt: (n, b, theme) =>
      `Ajoute des rangées de ${b} jusqu’à utiliser les ${n} ${FR_NOUNS[theme][1]}, sans rangée complète en trop.`,
    arrayReadout: (b, g, total, symbolFree) =>
      symbolFree ? `${g} rangées de ${b} font ${total}` : `${b} × ${g} = ${total}`,
    hintTooMany: 'C’est plus que ce que tu as. Enlève une rangée.',
    hintRoomForMore: (b) => `Il reste de la place pour une autre rangée de ${b}.`,
    resultEquality: (a, b, q, r) => (r === '0' ? `${a} ÷ ${b} = ${q}` : `${a} ÷ ${b} = ${q}, reste ${r}`),
    resultSentence: (q, theme, friends, r) =>
      `Chaque ${friends ? 'ami' : 'assiette'} a ${q} ${FR_NOUNS[theme][q === '1' ? 0 : 1]}.${
        r === '0' ? '' : ` Il en reste ${r}.`
      }`,
    summary: (levels, mistakesText) => `${levels} niveaux, ${mistakesText}`,
    starsLabel: (n) => `${n} étoiles sur 3`,
    groupsLabel: (b) => `Rangées de ${b}`
  }
};

export const getTranslations = createI18nResolver(DICTIONARY, 'en');

/** "no mistakes", "1 mistake", "3 mistakes" in the given language. */
export function mistakesText(lang: Lang, count: string, n: number): string {
  if (lang === 'fr') {
    if (n === 0) return 'aucune erreur';
    return n === 1 ? `${count} erreur` : `${count} erreurs`;
  }
  if (n === 0) return 'no mistakes';
  return n === 1 ? `${count} mistake` : `${count} mistakes`;
}
