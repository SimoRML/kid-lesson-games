import { createI18nResolver } from '../../src/core/i18n.js';

export type SupportedLocale = 'en' | 'fr';

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
  formatPreschoolPrompt: (loadKg: number, currentKg: number) => string;
  formatElementaryPrompt: (loadKg: number, targetKg: number, currentKg: number, ma: number) => string;
  formatUpperElementaryPrompt: (
    loadKg: number,
    loadNewtons: number,
    targetKg: number,
    targetNewtons: number,
    currentKg: number,
    currentNewtons: number,
    ma: number,
    ropeDistM: number,
    workJoules: number
  ) => string;
  hintOverweight: (currentKg: number, targetKg: number) => string;
  hintUnderweight: (remainingKg: number, remainingNewtons?: number) => string;
  hintSuccess: (loadKg: number, effortKg: number, ma: number, workJoules?: number) => string;
  units: {
    kg: string;
    newtons: string;
    joules: string;
    meters: string;
    ma: string;
  };
}

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
    formatPreschoolPrompt: (loadKg, currentKg) => {
      if (currentKg === 0) {
        return `Pull down on the rope! Match the ${loadKg} kg stone block with a ${loadKg} kg weight.`;
      }
      if (currentKg < loadKg) {
        return `Current: ${currentKg} kg / ${loadKg} kg. Add ${loadKg - currentKg} kg more!`;
      }
      if (currentKg > loadKg) {
        return `Too heavy (${currentKg} kg > ${loadKg} kg)! Tap a weight in the tray to return it.`;
      }
      return `✨ Perfect match! ${loadKg} kg counterweight lifts the ${loadKg} kg load!`;
    },
    formatElementaryPrompt: (loadKg, targetKg, currentKg, ma) => {
      if (currentKg === 0) {
        return `Movable pulley (MA = ${ma}) halves required force! Balance ${loadKg} kg with ${targetKg} kg. Combine weights!`;
      }
      if (currentKg < targetKg) {
        return `Current: ${currentKg} kg / ${targetKg} kg. Need ${targetKg - currentKg} kg more to balance the load! (MA = ${ma})`;
      }
      if (currentKg > targetKg) {
        return `Too much weight! ${currentKg} kg > ${targetKg} kg needed. Tap a weight to remove it.`;
      }
      return `✨ Balance achieved! ${currentKg} kg on MA = ${ma} lifts the massive ${loadKg} kg stone!`;
    },
    formatUpperElementaryPrompt: (
      loadKg,
      loadNewtons,
      targetKg,
      targetNewtons,
      currentKg,
      currentNewtons,
      ma,
      ropeDistM,
      workJoules
    ) => {
      if (currentKg === 0) {
        return `Block & Tackle (MA = ${ma}). Load: ${loadKg} kg (${loadNewtons} N). Target: ${targetKg} kg (${targetNewtons} N) over ${ropeDistM.toFixed(1)} m. Target Work: ${workJoules} J!`;
      }
      if (currentKg < targetKg) {
        const remKg = targetKg - currentKg;
        const remN = targetNewtons - currentNewtons;
        return `Effort: ${currentKg} kg (${currentNewtons} N) / ${targetKg} kg (${targetNewtons} N). Need +${remKg} kg (+${remN} N). Target Work: ${workJoules} J.`;
      }
      if (currentKg > targetKg) {
        return `Force exceeded! ${currentKg} kg (${currentNewtons} N) > ${targetKg} kg (${targetNewtons} N). Tap a weight in the tray to adjust.`;
      }
      return `✨ Work Conserved! W = ${targetNewtons} N × ${ropeDistM.toFixed(1)} m = ${workJoules} J = W_load! Hoisting stone block!`;
    },
    hintOverweight: (currentKg, targetKg) =>
      `Too heavy! Current: ${currentKg} kg > ${targetKg} kg. Tap a weight to return it.`,
    hintUnderweight: (remainingKg, remainingNewtons) =>
      remainingNewtons !== undefined
        ? `Add ${remainingKg} kg (${remainingNewtons} N) more to lift!`
        : `Add ${remainingKg} kg more to lift!`,
    hintSuccess: (loadKg, effortKg, ma, workJoules) =>
      workJoules !== undefined
        ? `✨ Hoisted! ${effortKg} kg lifts ${loadKg} kg via MA=${ma} (Work = ${workJoules} J)!`
        : `✨ Hoisted! ${effortKg} kg lifts ${loadKg} kg via MA=${ma}!`,
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
    formatPreschoolPrompt: (loadKg, currentKg) => {
      if (currentKg === 0) {
        return `Tire la corde ! Associe le bloc de ${loadKg} kg avec un poids de ${loadKg} kg.`;
      }
      if (currentKg < loadKg) {
        return `Actuel : ${currentKg} kg / ${loadKg} kg. Ajoute encore ${loadKg - currentKg} kg !`;
      }
      if (currentKg > loadKg) {
        return `Trop lourd (${currentKg} kg > ${loadKg} kg) ! Touche un poids pour le retirer.`;
      }
      return `✨ Équilibre parfait ! Le contrepoids de ${loadKg} kg soulève la charge de ${loadKg} kg !`;
    },
    formatElementaryPrompt: (loadKg, targetKg, currentKg, ma) => {
      if (currentKg === 0) {
        return `La poulie mobile (AM = ${ma}) divise l'effort par 2 ! Équilibre ${loadKg} kg avec ${targetKg} kg. Combine des poids !`;
      }
      if (currentKg < targetKg) {
        return `Actuel : ${currentKg} kg / ${targetKg} kg. Il manque ${targetKg - currentKg} kg pour équilibrer ! (AM = ${ma})`;
      }
      if (currentKg > targetKg) {
        return `Trop de poids ! ${currentKg} kg > ${targetKg} kg nécessaires. Touche un poids pour le retirer.`;
      }
      return `✨ Équilibre réussi ! ${currentKg} kg avec AM = ${ma} soulèvent le bloc géant de ${loadKg} kg !`;
    },
    formatUpperElementaryPrompt: (
      loadKg,
      loadNewtons,
      targetKg,
      targetNewtons,
      currentKg,
      currentNewtons,
      ma,
      ropeDistM,
      workJoules
    ) => {
      if (currentKg === 0) {
        return `Palan composé (AM = ${ma}). Charge : ${loadKg} kg (${loadNewtons} N). Cible : ${targetKg} kg (${targetNewtons} N) sur ${ropeDistM.toFixed(1)} m. Travail cible : ${workJoules} J !`;
      }
      if (currentKg < targetKg) {
        const remKg = targetKg - currentKg;
        const remN = targetNewtons - currentNewtons;
        return `Effort : ${currentKg} kg (${currentNewtons} N) / ${targetKg} kg (${targetNewtons} N). Reste +${remKg} kg (+${remN} N). Travail cible : ${workJoules} J.`;
      }
      if (currentKg > targetKg) {
        return `Force dépassée ! ${currentKg} kg (${currentNewtons} N) > ${targetKg} kg (${targetNewtons} N). Touche un poids pour ajuster.`;
      }
      return `✨ Conservation du Travail ! W = ${targetNewtons} N × ${ropeDistM.toFixed(1)} m = ${workJoules} J = W_charge ! Levage en cours !`;
    },
    hintOverweight: (currentKg, targetKg) =>
      `Trop lourd ! Actuel : ${currentKg} kg > ${targetKg} kg. Touche un poids pour le retirer.`,
    hintUnderweight: (remainingKg, remainingNewtons) =>
      remainingNewtons !== undefined
        ? `Ajoute encore ${remainingKg} kg (${remainingNewtons} N) pour soulever !`
        : `Ajoute encore ${remainingKg} kg pour soulever !`,
    hintSuccess: (loadKg, effortKg, ma, workJoules) =>
      workJoules !== undefined
        ? `✨ Soulevé ! ${effortKg} kg lèvent ${loadKg} kg grâce à AM=${ma} (Travail = ${workJoules} J) !`
        : `✨ Soulevé ! ${effortKg} kg lèvent ${loadKg} kg grâce à AM=${ma} !`,
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
