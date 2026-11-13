import { createI18nResolver } from '../../src/core/i18n.js';

export type SupportedLocale = 'en' | 'fr';

export interface Translations {
  title: string;
  level: string;
  score: string;
  reset: string;
  launch: string;
  resetMarble: string;
  soundOn: string;
  soundOff: string;
  trayLabel: string;
  woodRamp: string;
  trampoline: string;
  wellDone: string;
  summary: string;
  promptPreschool: string;
  promptElementary: string;
  promptUpperElementary: string;
  acute: string;
  right: string;
  obtuse: string;
  straight: string;
  woodInfo: string;
  trampolineInfo: string;
  formatAngleInfo: (angleDeg: number, classification: string) => string;
  formatReflectionHUD: (incidenceDeg: number, reflectionDeg: number, restitution: number) => string;
}

export const DICTIONARY: Record<SupportedLocale, Translations> = {
  en: {
    title: '🔴 Marble Run Angles',
    level: 'Level',
    score: 'Score',
    reset: 'Clear Pieces',
    launch: '▶ Launch',
    resetMarble: '↺ Reset',
    soundOn: '🔊 Sound ON',
    soundOff: '🔇 Sound OFF',
    trayLabel: 'Your Ramps & Trampolines',
    woodRamp: 'Wood Ramp',
    trampoline: 'Bouncy Trampoline',
    wellDone: '✨ In The Cup!',
    summary: 'Mastered slopes, geometry & reflection physics!',
    promptPreschool: 'Snap ramps into the glowing slots and tap Launch to roll!',
    promptElementary: 'Rotate ramps by 15° to steer around obstacle pegs into the cup!',
    promptUpperElementary: 'Tune reflection angles (θ_in = θ_ref) and bounciness across the chasm!',
    acute: 'Acute',
    right: 'Right Angle',
    obtuse: 'Obtuse',
    straight: 'Straight',
    woodInfo: 'Wood (e = 0.5 absorbs impact)',
    trampolineInfo: 'Trampoline (e = 0.9 super bouncy)',
    formatAngleInfo: (angleDeg, classification) => `${angleDeg}° (${classification})`,
    formatReflectionHUD: (iDeg, rDeg, e) => `θ_in: ${iDeg.toFixed(0)}° → θ_ref: ${rDeg.toFixed(0)}° | e = ${e.toFixed(1)}`
  },
  fr: {
    title: '🔴 Parcours à Billes & Angles',
    level: 'Niveau',
    score: 'Score',
    reset: 'Effacer pièces',
    launch: '▶ Lancer',
    resetMarble: '↺ Repositionner',
    soundOn: '🔊 Son ACTIVÉ',
    soundOff: '🔇 Son DÉSACTIVÉ',
    trayLabel: 'Tes Rampes & Trampolines',
    woodRamp: 'Rampe en bois',
    trampoline: 'Trampoline rebondissant',
    wellDone: '✨ Dans la cible !',
    summary: 'Pentes, géométrie et lois de réflexion maîtrisées !',
    promptPreschool: 'Place les rampes dans les fentes brillantes et appuie sur Lancer !',
    promptElementary: 'Fais pivoter les rampes par paliers de 15° pour contourner les piquets !',
    promptUpperElementary: 'Ajuste les angles de réflexion (θ_i = θ_r) et l’élasticité à travers le ravin !',
    acute: 'Aigu',
    right: 'Angle droit',
    obtuse: 'Obtus',
    straight: 'Plat',
    woodInfo: 'Bois (e = 0,5 absorbe le choc)',
    trampolineInfo: 'Trampoline (e = 0,9 très rebondissant)',
    formatAngleInfo: (angleDeg, classification) => `${angleDeg}° (${classification})`,
    formatReflectionHUD: (iDeg, rDeg, e) => `θ_i: ${iDeg.toFixed(0)}° → θ_r: ${rDeg.toFixed(0)}° | e = ${e.toFixed(1)}`
  }
};

export const getTranslations = createI18nResolver(DICTIONARY, 'en');
