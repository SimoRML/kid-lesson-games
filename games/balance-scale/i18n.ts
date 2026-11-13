import { createI18nResolver } from '../../src/core/i18n.js';

export type SupportedLocale = 'en' | 'fr';

export interface Translations {
  title: string;
  level: string;
  score: string;
  reset: string;
  soundOn: string;
  soundOff: string;
  yourWeights: string;
  rightHookLabel: string;
  notch: string;
  wellDone: string;
  summary: string;
  /** `leftCount` = number of weights on the left pan (defaults to counting " + " in `leftDesc`). */
  formatStandardInstruction: (leftDesc: string, totalGrams: number, rightStartGrams: number, leftCount?: number) => string;
  formatLeverInstruction: (leftGrams: number, leftNotch: number, targetTorque: number, rightNotch: number) => string;
  /** Live progress while the child fills the right pan (never states the missing amount). */
  formatStandardLive: (rightGrams: number, targetGrams: number) => string;
  formatLeverLive: (rightGrams: number, rightNotch: number, targetTorque: number) => string;
}

/** Single consistent metric format: "750g", "1 kg", "1.25 kg" (no nested parentheses). */
export function formatMetric(grams: number, locale: SupportedLocale): string {
  if (grams >= 1000) {
    const kg = (grams / 1000).toLocaleString(locale, { maximumFractionDigits: 2 });
    return `${kg.replace(/\u202f|\u00a0/g, ' ')} kg`;
  }
  return `${grams}g`;
}

function countParts(leftDesc: string, leftCount?: number): number {
  return leftCount ?? leftDesc.split(' + ').length;
}

export const DICTIONARY: Record<SupportedLocale, Translations> = {
  en: {
    title: '⚖️ Balance Lab',
    level: 'Level',
    score: 'Score',
    reset: 'New Puzzle',
    soundOn: '🔊 Sound ON',
    soundOff: '🔇 Sound OFF',
    yourWeights: 'Your Metric Weights',
    rightHookLabel: 'Right Hook Notch:',
    notch: 'Notch',
    wellDone: '✨ Perfect Balance!',
    summary: 'Mastered balance, metric conversions & levers!',
    formatStandardInstruction: (leftDesc, totalGrams, rightStartGrams, leftCount) => {
      const totalStr = formatMetric(totalGrams, 'en');
      const shown = countParts(leftDesc, leftCount) >= 2 ? `${leftDesc} (${totalStr})` : leftDesc;
      if (rightStartGrams > 0) {
        return `Left has ${shown}, right has ${formatMetric(rightStartGrams, 'en')}. Add ${formatMetric(totalGrams - rightStartGrams, 'en')} using different weights!`;
      }
      return `Balance ${shown} using a different combination of weights!`;
    },
    formatLeverInstruction: (leftGrams, leftNotch, targetTorque, rightNotch) => {
      const base = `Left: ${leftGrams}g × ${leftNotch} = ${targetTorque}. Make the right side equal ${targetTorque}!`;
      if (targetTorque % rightNotch !== 0) {
        return `${base} Move the right hook to a notch that divides ${targetTorque} evenly.`;
      }
      return base;
    },
    formatStandardLive: (rightGrams, targetGrams) => {
      const right = formatMetric(rightGrams, 'en');
      if (rightGrams === targetGrams) return `Right: ${right}. Perfectly balanced!`;
      if (rightGrams > targetGrams) return `Right: ${right} is too heavy, take something off!`;
      return `Right: ${right} of ${formatMetric(targetGrams, 'en')}, keep going!`;
    },
    formatLeverLive: (rightGrams, rightNotch, targetTorque) => {
      const torque = rightGrams * rightNotch;
      const eq = `Right torque: ${rightGrams}g × ${rightNotch} = ${torque}`;
      if (torque === targetTorque) return `${eq}. Perfectly balanced!`;
      if (torque > targetTorque) return `${eq} is more than ${targetTorque}. Too heavy!`;
      return `${eq} / ${targetTorque}. A little more!`;
    }
  },
  fr: {
    title: '⚖️ Labo d’Équilibre',
    level: 'Niveau',
    score: 'Score',
    reset: 'Nouveau Défi',
    soundOn: '🔊 Son ACTIF',
    soundOff: '🔇 Son COUPÉ',
    yourWeights: 'Vos Poids Métriques',
    rightHookLabel: 'Cran du crochet droit :',
    notch: 'Cran',
    wellDone: '✨ Équilibre Parfait !',
    summary: 'Maîtrise de l’équilibre, des conversions et des leviers !',
    formatStandardInstruction: (leftDesc, totalGrams, rightStartGrams, leftCount) => {
      const totalStr = formatMetric(totalGrams, 'fr');
      const shown = countParts(leftDesc, leftCount) >= 2 ? `${leftDesc} (${totalStr})` : leftDesc;
      if (rightStartGrams > 0) {
        return `Gauche : ${shown}, Droite : ${formatMetric(rightStartGrams, 'fr')}. Ajoutez ${formatMetric(totalGrams - rightStartGrams, 'fr')} avec d'autres poids !`;
      }
      return `Équilibrez ${shown} avec une combinaison différente de poids !`;
    },
    formatLeverInstruction: (leftGrams, leftNotch, targetTorque, rightNotch) => {
      const base = `Gauche : ${leftGrams}g × ${leftNotch} = ${targetTorque}. Rendez le côté droit égal à ${targetTorque} !`;
      if (targetTorque % rightNotch !== 0) {
        return `${base} Déplacez le crochet sur un cran qui divise ${targetTorque}.`;
      }
      return base;
    },
    formatStandardLive: (rightGrams, targetGrams) => {
      const right = formatMetric(rightGrams, 'fr');
      if (rightGrams === targetGrams) return `Droite : ${right}. Équilibre parfait !`;
      if (rightGrams > targetGrams) return `Droite : ${right}, c'est trop lourd, retirez un poids !`;
      return `Droite : ${right} sur ${formatMetric(targetGrams, 'fr')}, continuez !`;
    },
    formatLeverLive: (rightGrams, rightNotch, targetTorque) => {
      const torque = rightGrams * rightNotch;
      const eq = `Force à droite : ${rightGrams}g × ${rightNotch} = ${torque}`;
      if (torque === targetTorque) return `${eq}. Équilibre parfait !`;
      if (torque > targetTorque) return `${eq}, plus que ${targetTorque}. Trop lourd !`;
      return `${eq} / ${targetTorque}. Encore un peu !`;
    }
  }
};

export const getTranslations = createI18nResolver<Translations>(DICTIONARY, 'en');
