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
  wellDone: string;
  summary: string;
  formatStandardInstruction: (leftDesc: string, totalGrams: number, rightStartGrams: number) => string;
  formatLeverInstruction: (leftGrams: number, leftNotch: number, targetTorque: number, rightNotch: number) => string;
}

function formatMetric(grams: number, locale: SupportedLocale): string {
  if (grams >= 1000 && grams % 1000 === 0) {
    return `${grams / 1000} kg (${grams}g)`;
  }
  if (grams >= 1000) {
    const kg = (grams / 1000).toLocaleString(locale, { maximumFractionDigits: 2 });
    return `${kg} kg (${grams}g)`;
  }
  return `${grams}g`;
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
    wellDone: '✨ Perfect Balance!',
    summary: 'Mastered balance, metric conversions & levers!',
    formatStandardInstruction: (leftDesc, totalGrams, rightStartGrams) => {
      const totalStr = formatMetric(totalGrams, 'en');
      if (rightStartGrams > 0) {
        return `Left has ${leftDesc} (${totalStr}), right has ${rightStartGrams}g. Add ${totalGrams - rightStartGrams}g using different weights!`;
      }
      return `Balance ${leftDesc} (${totalStr}) using a different combination of weights!`;
    },
    formatLeverInstruction: (leftGrams, leftNotch, targetTorque, rightNotch) => {
      const neededGrams = Math.round(targetTorque / rightNotch);
      const isInteger = targetTorque % rightNotch === 0;
      if (!isInteger) {
        return `Left torque is ${leftGrams}g × ${leftNotch} = ${targetTorque}. Move right hook to a notch that divides ${targetTorque} evenly!`;
      }
      return `Left torque: ${leftGrams}g × ${leftNotch} = ${targetTorque}. At right notch ${rightNotch}, you need ${neededGrams}g (${neededGrams} × ${rightNotch} = ${targetTorque})!`;
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
    wellDone: '✨ Équilibre Parfait !',
    summary: 'Maîtrise de l’équilibre, des conversions et des leviers !',
    formatStandardInstruction: (leftDesc, totalGrams, rightStartGrams) => {
      const totalStr = formatMetric(totalGrams, 'fr');
      if (rightStartGrams > 0) {
        return `Gauche : ${leftDesc} (${totalStr}), Droite : ${rightStartGrams}g. Ajoutez ${totalGrams - rightStartGrams}g avec d'autres poids !`;
      }
      return `Équilibrez ${leftDesc} (${totalStr}) avec une combinaison différente de poids !`;
    },
    formatLeverInstruction: (leftGrams, leftNotch, targetTorque, rightNotch) => {
      const neededGrams = Math.round(targetTorque / rightNotch);
      const isInteger = targetTorque % rightNotch === 0;
      if (!isInteger) {
        return `Force à gauche : ${leftGrams}g × ${leftNotch} = ${targetTorque}. Déplacez le crochet sur un cran qui divise ${targetTorque} !`;
      }
      return `Force à gauche : ${leftGrams}g × ${leftNotch} = ${targetTorque}. Au cran ${rightNotch}, il faut ${neededGrams}g (${neededGrams} × ${rightNotch} = ${targetTorque}) !`;
    }
  }
};

export function getTranslations(locale?: string): Translations {
  if (locale && locale.startsWith('fr')) return DICTIONARY.fr;
  return DICTIONARY.en;
}
