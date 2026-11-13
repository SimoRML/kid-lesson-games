import { createI18nResolver } from '../../src/core/i18n.js';

export type SupportedLocale = 'en' | 'fr';

/**
 * Coarse feedback state of the effort tray relative to the (hidden) required effort.
 * The HUD only ever receives this direction, never the exact target or remainder.
 */
export type HintState = 'empty' | 'low' | 'close' | 'over' | 'match';

export interface PulleyTranslations {
  title: string;
  level: string;
  score: string;
  reset: string;
  soundOn: string;
  soundOff: string;
  inventoryLabel: string;
  effortTrayLabel: string;
  loadLabel: string;
  wellDone: string;
  summary: string;
  /** Canvas tag drawn next to the target line, e.g. "Target: 2 m". */
  targetHeight: (meters: number) => string;
  /** Plain-language description of what the rig does to the effort (6-8). */
  maRule: (ma: number) => string;
  formatPreschoolPrompt: (loadKg: number, currentKg: number, state: HintState) => string;
  formatElementaryPrompt: (
    loadKg: number,
    currentKg: number,
    ma: number,
    state: HintState
  ) => string;
  formatUpperElementaryPrompt: (
    loadKg: number,
    loadNewtons: number,
    currentKg: number,
    currentNewtons: number,
    ma: number,
    state: HintState,
    ropeDistM: number,
    workJoules: number
  ) => string;
  units: {
    kg: string;
    newtons: string;
    joules: string;
    meters: string;
    ma: string;
  };
}

const frNum = (n: number): string => String(n).replace('.', ',');

export const DICTIONARY: Record<SupportedLocale, PulleyTranslations> = {
  en: {
    title: '🏗️ Pulley Lift',
    level: 'Level',
    score: 'Score',
    reset: 'Clear Tray',
    soundOn: '🔊 Sound ON',
    soundOff: '🔇 Sound OFF',
    inventoryLabel: 'Counterweights',
    effortTrayLabel: 'Effort Tray',
    loadLabel: 'Stone Load',
    wellDone: '✨ Stone Block Hoisted!',
    summary: 'Mastered simple machines, mechanical advantage & work conservation!',
    targetHeight: (m) => `🎯 Target: ${m} m`,
    maRule: (ma) => {
      switch (ma) {
        case 1:
          return 'the effort is the same as the load';
        case 2:
          return 'the effort is half the load';
        case 3:
          return 'the effort is one third of the load';
        default:
          return 'the effort is one quarter of the load';
      }
    },
    formatPreschoolPrompt: (loadKg, currentKg, state) => {
      switch (state) {
        case 'empty':
          return `Tap a weight to balance the ${loadKg} kg stone.`;
        case 'low':
          return `Your weights: ${currentKg} kg. The stone needs more!`;
        case 'close':
          return `Your weights: ${currentKg} kg. Almost! Add a little more.`;
        case 'over':
          return 'Too heavy! Tap a weight in the Effort tray to take it back.';
        default:
          return `✨ Perfect match! ${currentKg} kg lifts the ${loadKg} kg stone!`;
      }
    },
    formatElementaryPrompt: (loadKg, currentKg, ma, state) => {
      switch (state) {
        case 'empty':
          return `MA = ${ma}: ${DICTIONARY.en.maRule(ma)}. The stone is ${loadKg} kg. Work out the effort you need, then tap weights!`;
        case 'low':
          return `Effort: ${currentKg} kg (MA = ${ma}). Not enough yet, keep adding.`;
        case 'close':
          return `Effort: ${currentKg} kg (MA = ${ma}). Getting close, a little more!`;
        case 'over':
          return `Effort: ${currentKg} kg. Too heavy! Tap a weight in the Effort tray to take it back.`;
        default:
          return `✨ Balance achieved! ${currentKg} kg on MA = ${ma} lifts the ${loadKg} kg stone!`;
      }
    },
    formatUpperElementaryPrompt: (
      loadKg,
      loadNewtons,
      currentKg,
      currentNewtons,
      ma,
      state,
      ropeDistM,
      workJoules
    ) => {
      switch (state) {
        case 'empty':
          return `Block & Tackle (MA = ${ma}). Load: ${loadKg} kg (${loadNewtons} N). Find the effort that balances it.`;
        case 'low':
          return `Effort: ${currentKg} kg (${currentNewtons} N). Not enough to lift the load yet.`;
        case 'close':
          return `Effort: ${currentKg} kg (${currentNewtons} N). Almost there, a little more.`;
        case 'over':
          return `Effort: ${currentKg} kg (${currentNewtons} N). Too much force! Tap a weight in the Effort tray to take it back.`;
        default:
          return `✨ Work conserved! W = ${currentNewtons} N × ${ropeDistM.toFixed(1)} m = ${workJoules} J = W_load. Hoisting!`;
      }
    },
    units: {
      kg: 'kg',
      newtons: 'N',
      joules: 'J',
      meters: 'm',
      ma: 'MA'
    }
  },
  fr: {
    title: '🏗️ Poulies & Palans',
    level: 'Niveau',
    score: 'Score',
    reset: 'Vider le plateau',
    soundOn: '🔊 Son ACTIVÉ',
    soundOff: '🔇 Son DÉSACTIVÉ',
    inventoryLabel: 'Contrepoids',
    effortTrayLabel: 'Plateau d’effort',
    loadLabel: 'Charge de pierre',
    wellDone: '✨ Bloc de Pierre Soulevé !',
    summary: 'Poulies, avantage mécanique et conservation du travail maîtrisés !',
    targetHeight: (m) => `🎯 Cible : ${frNum(m)} m`,
    maRule: (ma) => {
      switch (ma) {
        case 1:
          return "l'effort est égal à la charge";
        case 2:
          return "l'effort est la moitié de la charge";
        case 3:
          return "l'effort est le tiers de la charge";
        default:
          return "l'effort est le quart de la charge";
      }
    },
    formatPreschoolPrompt: (loadKg, currentKg, state) => {
      switch (state) {
        case 'empty':
          return `Touche un poids pour équilibrer la pierre de ${loadKg} kg.`;
        case 'low':
          return `Tes poids : ${currentKg} kg. La pierre a besoin de plus !`;
        case 'close':
          return `Tes poids : ${currentKg} kg. Presque ! Ajoute un petit peu.`;
        case 'over':
          return "Trop lourd ! Touche un poids du plateau d'effort pour le reprendre.";
        default:
          return `✨ Équilibre parfait ! ${currentKg} kg soulèvent la pierre de ${loadKg} kg !`;
      }
    },
    formatElementaryPrompt: (loadKg, currentKg, ma, state) => {
      switch (state) {
        case 'empty':
          return `AM = ${ma} : ${DICTIONARY.fr.maRule(ma)}. La pierre fait ${loadKg} kg. Calcule l'effort nécessaire, puis touche des poids !`;
        case 'low':
          return `Effort : ${currentKg} kg (AM = ${ma}). Pas encore assez, continue.`;
        case 'close':
          return `Effort : ${currentKg} kg (AM = ${ma}). Tu y es presque, encore un peu !`;
        case 'over':
          return `Effort : ${currentKg} kg. Trop lourd ! Touche un poids du plateau d'effort pour le reprendre.`;
        default:
          return `✨ Équilibre réussi ! ${currentKg} kg avec AM = ${ma} soulèvent la pierre de ${loadKg} kg !`;
      }
    },
    formatUpperElementaryPrompt: (
      loadKg,
      loadNewtons,
      currentKg,
      currentNewtons,
      ma,
      state,
      ropeDistM,
      workJoules
    ) => {
      switch (state) {
        case 'empty':
          return `Palan composé (AM = ${ma}). Charge : ${loadKg} kg (${loadNewtons} N). Trouve l'effort qui l'équilibre.`;
        case 'low':
          return `Effort : ${currentKg} kg (${currentNewtons} N). Pas encore assez pour soulever la charge.`;
        case 'close':
          return `Effort : ${currentKg} kg (${currentNewtons} N). Presque, encore un peu.`;
        case 'over':
          return `Effort : ${currentKg} kg (${currentNewtons} N). Force trop grande ! Touche un poids du plateau d'effort pour le reprendre.`;
        default:
          return `✨ Travail conservé ! W = ${currentNewtons} N × ${frNum(Number(ropeDistM.toFixed(1)))} m = ${workJoules} J = W_charge. Levage !`;
      }
    },
    units: {
      kg: 'kg',
      newtons: 'N',
      joules: 'J',
      meters: 'm',
      ma: 'AM'
    }
  }
};

export const getTranslations = createI18nResolver<PulleyTranslations>(DICTIONARY, 'en');
