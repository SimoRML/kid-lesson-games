/**
 * EN/FR strings and number formatting for the Candy Factory.
 * Pure module: no DOM access. All numbers arrive already formatted.
 */

import { createI18nResolver } from '../../src/core/i18n.js';

export type Lang = 'en' | 'fr';

/** Reduces any externally supplied locale to a language this cartridge ships. */
export function normalizeLocale(raw: unknown): Lang {
  if (typeof raw !== 'string') return 'en';
  const primary = raw.trim().toLowerCase().split('-')[0].split('_')[0];
  return primary === 'fr' ? 'fr' : 'en';
}

const formatters = new Map<Lang, Intl.NumberFormat>();

/** Locale-aware integer formatting: `2 458` in fr, `2,458` in en. */
export function formatNumber(n: number, locale: unknown): string {
  const lang = normalizeLocale(locale);
  let fmt = formatters.get(lang);
  if (!fmt) {
    fmt = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
    formatters.set(lang, fmt);
  }
  return fmt.format(n);
}

/** Customer names (shared by both languages). */
export const CUSTOMERS = ['Yasmine', 'Amine', 'Salma', 'Youssef', 'Nora', 'Karim', 'Aya', 'Omar', 'Lina', 'Adam'] as const;

export interface Dictionary {
  title: string;
  playAgain: string;
  ship: string;
  check: string;
  erase: string;
  levelWord(index: string, total: string): string;
  /** Item name for a place-value column (0 candies, 1 bags, 2 boxes, 3 crates). */
  unit(column: number, count: number): string;
  /** Machine that packs column `column` into column + 1. */
  machine(column: number): string;
  /** Written-mode column name (0 units ... 4 ten thousands). */
  columnName(column: number): string;
  /** Short column header for the written grid (u d c m / U T H Th). */
  colLetter(column: number): string;

  // count
  countPrompt(name: string, n: string): string;
  countLive(n: string): string;
  addCandy: string;
  tooFew: string;
  tooMany: string;
  bagMade: string;

  // compare
  comparePrompt(ask: 'more' | 'fewer'): string;
  compareHintTens: string;
  compareHintSmall: string;
  jarOf(name: string): string;

  // physical add
  packPrompt(name: string, orders: string): string;
  packLive(parts: string): string;
  truckRefuses(unit: string, machine: string): string;
  needTen(unit: string): string;
  funnel(count: string): string;
  labelPrompt: string;
  labelWrong: string;

  // written add
  writtenIntro: string;
  writtenPrompt(column: string): string;
  writtenWrong(column: string): string;
  needCarry(total: string): string;
  noCarry: string;
  carryBox(column: string): string;
  lastCarry: string;

  // mystery / robot / estimate
  mysteryPrompt: string;
  mysteryWrong: string;
  robotPrompt: string;
  robotRight: string;
  robotFix: string;
  robotWrongFix: string;
  estimatePrompt: string;
  estimateWrong: string;
  truck(n: string): string;
  exactly(n: string): string;

  // bill
  bill: string;
  items: readonly string[];
  currency: string;
  total: string;

  // shell
  stickers: string;
  summary(levels: string, mistakes: string): string;
  mistakesWord(n: number): string;
  starsLabel(stars: number): string;
}

const EN_UNITS: ReadonlyArray<[string, string]> = [
  ['candy', 'candies'],
  ['bag', 'bags'],
  ['box', 'boxes'],
  ['crate', 'crates']
];
const FR_UNITS: ReadonlyArray<[string, string]> = [
  ['bonbon', 'bonbons'],
  ['sachet', 'sachets'],
  ['boîte', 'boîtes'],
  ['caisse', 'caisses']
];

function unitFrom(table: ReadonlyArray<[string, string]>, column: number, count: number): string {
  const row = table[Math.max(0, Math.min(table.length - 1, column))];
  return count === 1 ? row[0] : row[1];
}

const en: Dictionary = {
  title: 'Candy Factory',
  playAgain: 'Open the factory again',
  ship: 'Ship it! 🚚',
  check: 'Check',
  erase: 'Erase',
  levelWord: (i, t) => `Order ${i}/${t}`,
  unit: (c, n) => unitFrom(EN_UNITS, c, n),
  machine: (c) => ['Bag machine', 'Box machine', 'Crate machine'][Math.min(2, Math.max(0, c))],
  columnName: (c) => ['units', 'tens', 'hundreds', 'thousands', 'ten thousands'][Math.min(4, Math.max(0, c))],
  colLetter: (c) => ['U', 'T', 'H', 'Th', 'TTh'][Math.min(4, Math.max(0, c))],

  countPrompt: (name, n) => `${name} wants ${n}! Tap the jar to drop candies in the bag.`,
  countLive: (n) => `In the bag: ${n}`,
  addCandy: 'Drop a candy',
  tooFew: 'A few more, please!',
  tooMany: 'Oops, too many! Tap a candy in the bag to take it back.',
  bagMade: '10 candies make 1 bag!',

  comparePrompt: (ask) => (ask === 'more' ? 'Who has MORE candies? Tap that jar.' : 'Who has FEWER candies? Tap that jar.'),
  compareHintTens: 'Look at the bags first: each bag holds 10 candies!',
  compareHintSmall: 'Count again, one candy at a time.',
  jarOf: (name) => `${name}'s jar`,

  packPrompt: (name, orders) => `${name} orders ${orders}. Pack it: 10 make 1 bigger pack!`,
  packLive: (parts) => `On the belt: ${parts}`,
  truckRefuses: (unit, machine) => `The driver says: too many loose ${unit}! Use the ${machine}.`,
  needTen: (unit) => `The machine needs 10 ${unit}.`,
  funnel: (n) => `${n}/10`,
  labelPrompt: 'All packed! Write the label: how many candies in total?',
  labelWrong: 'Not quite. Read the crates, boxes, bags and candies again.',

  writtenIntro: 'Written mode! A bag of 10 becomes a carry 1.',
  writtenPrompt: (col) => `Add the ${col} column, then type its digit.`,
  writtenWrong: (col) => `Not quite. Add the ${col} column again, carry included.`,
  needCarry: (total) => `${total}: that is 10 or more! Tap the carry box above the next column.`,
  noCarry: 'No carry here: this column is less than 10.',
  carryBox: (col) => `Carry for the ${col} column`,
  lastCarry: 'The last carry goes down to the front of the answer.',

  mysteryPrompt: 'The label is torn! Which digit is missing?',
  mysteryWrong: 'Not that one. Add the column and check the carry.',
  robotPrompt: 'Robo-Packer made one mistake. Tap the wrong digit!',
  robotRight: 'That digit is right. Look for a forgotten carry!',
  robotFix: 'Found it! Now type the right digit.',
  robotWrongFix: 'Not yet. Add that column with its carry.',
  estimatePrompt: 'Which truck fits best? Round to the nearest thousand.',
  estimateWrong: 'Round each order to the nearest thousand, then add.',
  truck: (n) => `≈ ${n}`,
  exactly: (n) => `Exactly ${n}!`,

  bill: 'Bill',
  items: ['Shirts', 'Caps', 'Balls'],
  currency: 'Dh',
  total: 'Total',

  stickers: 'Sticker shelf',
  summary: (levels, mistakes) => `${levels} orders shipped with ${mistakes}.`,
  mistakesWord: (n) => (n === 1 ? 'mistake' : 'mistakes'),
  starsLabel: (s) => `${s} out of 3 stars`
};

const fr: Dictionary = {
  title: 'La Fabrique de Bonbons',
  playAgain: 'Rouvrir la fabrique',
  ship: 'Expédier ! 🚚',
  check: 'Vérifier',
  erase: 'Effacer',
  levelWord: (i, t) => `Commande ${i}/${t}`,
  unit: (c, n) => unitFrom(FR_UNITS, c, n),
  machine: (c) => ['machine à sachets', 'machine à boîtes', 'machine à caisses'][Math.min(2, Math.max(0, c))],
  columnName: (c) => ['unités', 'dizaines', 'centaines', 'milliers', 'dizaines de milliers'][Math.min(4, Math.max(0, c))],
  colLetter: (c) => ['u', 'd', 'c', 'm', 'dm'][Math.min(4, Math.max(0, c))],

  countPrompt: (name, n) => `${name} veut ${n} ! Touche le bocal pour mettre des bonbons dans le sachet.`,
  countLive: (n) => `Dans le sachet : ${n}`,
  addCandy: 'Ajouter un bonbon',
  tooFew: 'Encore quelques-uns, s’il te plaît !',
  tooMany: 'Oups, trop ! Touche un bonbon du sachet pour le reprendre.',
  bagMade: '10 bonbons font 1 sachet !',

  comparePrompt: (ask) => (ask === 'more' ? 'Qui a le PLUS de bonbons ? Touche son bocal.' : 'Qui a le MOINS de bonbons ? Touche son bocal.'),
  compareHintTens: 'Regarde d’abord les sachets : chaque sachet contient 10 bonbons !',
  compareHintSmall: 'Recompte, un bonbon à la fois.',
  jarOf: (name) => `Bocal de ${name}`,

  packPrompt: (name, orders) => `${name} commande ${orders}. Emballe : 10 font 1 paquet plus grand !`,
  packLive: (parts) => `Sur le tapis : ${parts}`,
  truckRefuses: (unit, machine) => `Le chauffeur dit : trop de ${unit} en vrac ! Utilise la ${machine}.`,
  needTen: (unit) => `La machine a besoin de 10 ${unit}.`,
  funnel: (n) => `${n}/10`,
  labelPrompt: 'Tout est emballé ! Écris l’étiquette : combien de bonbons en tout ?',
  labelWrong: 'Pas tout à fait. Relis les caisses, boîtes, sachets et bonbons.',

  writtenIntro: 'Mode écrit ! Un sachet de 10 devient une retenue 1.',
  writtenPrompt: (col) => `Additionne la colonne des ${col}, puis tape son chiffre.`,
  writtenWrong: (col) => `Pas tout à fait. Additionne encore la colonne des ${col}, retenue comprise.`,
  needCarry: (total) => `${total} : c’est 10 ou plus ! Touche la case de retenue au-dessus de la colonne suivante.`,
  noCarry: 'Pas de retenue ici : cette colonne fait moins de 10.',
  carryBox: (col) => `Retenue de la colonne des ${col}`,
  lastCarry: 'La dernière retenue descend devant le résultat.',

  mysteryPrompt: 'L’étiquette est déchirée ! Quel chiffre manque ?',
  mysteryWrong: 'Ce n’est pas celui-là. Additionne la colonne et vérifie la retenue.',
  robotPrompt: 'Robo-Emballeur a fait une erreur. Touche le chiffre faux !',
  robotRight: 'Ce chiffre est juste. Cherche une retenue oubliée !',
  robotFix: 'Trouvé ! Tape maintenant le bon chiffre.',
  robotWrongFix: 'Pas encore. Additionne cette colonne avec sa retenue.',
  estimatePrompt: 'Quel camion convient le mieux ? Arrondis au millier le plus proche.',
  estimateWrong: 'Arrondis chaque commande au millier le plus proche, puis additionne.',
  truck: (n) => `≈ ${n}`,
  exactly: (n) => `Exactement ${n} !`,

  bill: 'Facture',
  items: ['Maillots', 'Casquettes', 'Ballons'],
  currency: 'Dh',
  total: 'Total',

  stickers: 'Étagère à autocollants',
  summary: (levels, mistakes) => `${levels} commandes expédiées avec ${mistakes}.`,
  mistakesWord: (n) => (n <= 1 ? 'erreur' : 'erreurs'),
  starsLabel: (s) => `${s} étoile${s > 1 ? 's' : ''} sur 3`
};

export const DICTIONARY: Record<Lang, Dictionary> = { en, fr };

export const getTranslations = createI18nResolver<Dictionary>(DICTIONARY, 'en');

/** "3 bags + 12 candies" with only the non-zero parts, highest first. */
export function describeCounts(dict: Dictionary, counts: readonly number[], fmt: (n: number) => string): string {
  const parts: string[] = [];
  for (let c = counts.length - 1; c >= 0; c--) {
    if (counts[c] > 0) parts.push(`${fmt(counts[c])} ${dict.unit(c, counts[c])}`);
  }
  return parts.length > 0 ? parts.join(' + ') : `0 ${dict.unit(0, 0)}`;
}
