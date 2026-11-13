import { createI18nResolver } from '../../src/core/i18n.js';

export type SupportedLocale = 'en' | 'fr';

export interface PendulumTranslations {
  title: string;
  level: string;
  score: string;
  reset: string;
  soundOn: string;
  soundOff: string;
  wellDone: string;
  summary: string;
  pullAngle: string;
  massNote: string;
  lengthNote: string;
  streakProgress: string;
  ratioCurrent: string;
  releaseBoth: string;
  resetBlocks: string;
  resetSwing: string;
  gentlePreset: string;
  mediumPreset: string;
  smashPreset: string;
  formatPreschoolPrompt: (angleDeg: number, blocksRemaining: number) => string;
  formatElementaryPrompt: (
    bpm: number,
    currentLengthCm: number,
    currentMassG: number,
    streak: number,
    targetStreak: number
  ) => string;
  formatUpperPrompt: (
    targetRatio: string,
    lengthA: number,
    lengthB: number,
    currentRatio: string,
    coincidences: number,
    targetCoincidences: number
  ) => string;
  formatHitSuccess: (step: number, total: number) => string;
  units: {
    cm: string;
    m: string;
    g: string;
    bpm: string;
    sec: string;
    deg: string;
  };
}

export const DICTIONARY: Record<SupportedLocale, PendulumTranslations> = {
  en: {
    title: '⏱️ Pendulum Rhythm Lab',
    level: 'Level',
    score: 'Score',
    reset: 'Reset',
    soundOn: '🔊 Sound ON',
    soundOff: '🔇 Sound OFF',
    wellDone: '✨ Harmonic Perfection!',
    summary: 'Mastered time, pendulum periodicity, Galileo\'s invariant & polyrhythm ratios!',
    pullAngle: 'Release Angle: {angle}°',
    massNote: 'Mass: {mass}g (Mass does not affect swing period!)',
    lengthNote: 'Length: {length}cm (Shorter = Faster, Longer = Slower)',
    streakProgress: 'Beat Match: {count}/{target}',
    ratioCurrent: 'Current Ratio: {current} | Target: {target}',
    releaseBoth: 'Release Together',
    resetBlocks: 'Reset Blocks',
    resetSwing: 'Reset Swing',
    gentlePreset: 'Gentle (20°)',
    mediumPreset: 'Medium (40°)',
    smashPreset: 'Smash! (60°)',
    formatPreschoolPrompt: (angleDeg: number, blocksRemaining: number) => {
      if (blocksRemaining === 0) {
        return '💥 Fantastic smash! All blocks tumbled over!';
      }
      if (angleDeg < 10) {
        return `Pull back the ball and let go to knock over ${blocksRemaining} block${blocksRemaining > 1 ? 's' : ''}!`;
      }
      if (angleDeg < 35) {
        return `Angle: ${angleDeg}° — Pull a bit higher for maximum smash power!`;
      }
      return `Angle: ${angleDeg}° — High power! Release to smash!`;
    },
    formatElementaryPrompt: (bpm, currentLengthCm, currentMassG, streak, targetStreak) => {
      if (streak >= targetStreak) {
        return `✨ Perfect tempo lock! Synchronized with ${bpm} BPM!`;
      }
      if (streak > 0) {
        return `🔥 In sync! Beat match streak: ${streak}/${targetStreak} (${bpm} BPM)! Keep swinging!`;
      }
      return `Match the ${bpm} BPM beat! (Length: ${currentLengthCm}cm, Mass: ${currentMassG}g). Hint: only string length changes swing speed!`;
    },
    formatUpperPrompt: (targetRatio, lengthA, lengthB, currentRatio, coincidences, targetCoincidences) => {
      if (coincidences >= targetCoincidences) {
        return `✨ Locked in harmony! ${targetRatio} polyrhythm validated!`;
      }
      if (coincidences > 0) {
        return `🎶 Coincidence hit! (${coincidences}/${targetCoincidences} - ${targetRatio} polyrhythm). Ratio: ${currentRatio} (T ∝ √L)`;
      }
      return `Target: ${targetRatio} polyrhythm. Pendulum A: ${lengthA}cm, B: ${lengthB}cm. Ratio: ${currentRatio}. Remember: length ratio = (ratio)²!`;
    },
    formatHitSuccess: (step, total) => `✨ Stage ${step} of ${total} Cleared!`,
    units: {
      cm: 'cm',
      m: 'm',
      g: 'g',
      bpm: 'BPM',
      sec: 's',
      deg: '°'
    }
  },
  fr: {
    title: '⏱️ Laboratoire du Pendule & Rythme',
    level: 'Niveau',
    score: 'Score',
    reset: 'Réinitialiser',
    soundOn: '🔊 Son ACTIVÉ',
    soundOff: '🔇 Son DÉSACTIVÉ',
    wellDone: '✨ Harmonie Parfaite !',
    summary: 'Périodicité, invariant de Galilée et rapports de polyrythmes maîtrisés !',
    pullAngle: 'Angle de lâcher : {angle}°',
    massNote: 'Masse : {mass}g (La masse n\'affecte pas la période d\'oscillation !)',
    lengthNote: 'Longueur : {length}cm (Plus court = plus rapide, plus long = plus lent)',
    streakProgress: 'Synchronisation : {count}/{target}',
    ratioCurrent: 'Rapport actuel : {current} | Cible : {target}',
    releaseBoth: 'Lâcher ensemble',
    resetBlocks: 'Réinitialiser les blocs',
    resetSwing: 'Réinitialiser le pendule',
    gentlePreset: 'Doux (20°)',
    mediumPreset: 'Moyen (40°)',
    smashPreset: 'Écraser ! (60°)',
    formatPreschoolPrompt: (angleDeg: number, blocksRemaining: number) => {
      if (blocksRemaining === 0) {
        return '💥 Renversement spectaculaire ! Tous les blocs sont tombés !';
      }
      if (angleDeg < 10) {
        return `Tire la boule en arrière et lâche-la pour faire tomber ${blocksRemaining} bloc${blocksRemaining > 1 ? 's' : ''} !`;
      }
      if (angleDeg < 35) {
        return `Angle : ${angleDeg}° — Tire un peu plus haut pour plus de force d'impact !`;
      }
      return `Angle : ${angleDeg}° — Pleine puissance ! Lâche pour frapper !`;
    },
    formatElementaryPrompt: (bpm, currentLengthCm, currentMassG, streak, targetStreak) => {
      if (streak >= targetStreak) {
        return `✨ Synchronisation parfaite au tempo de ${bpm} BPM !`;
      }
      if (streak > 0) {
        return `🔥 En rythme ! Série de synchronisation : ${streak}/${targetStreak} (${bpm} BPM) !`;
      }
      return `Ajuste au rythme de ${bpm} BPM ! (Longueur : ${currentLengthCm}cm, Masse : ${currentMassG}g). Indice : seule la longueur modifie la vitesse !`;
    },
    formatUpperPrompt: (targetRatio, lengthA, lengthB, currentRatio, coincidences, targetCoincidences) => {
      if (coincidences >= targetCoincidences) {
        return `✨ Harmonie verrouillée ! Polyrythme ${targetRatio} validé !`;
      }
      if (coincidences > 0) {
        return `🎶 Coïncidence harmonique ! (${coincidences}/${targetCoincidences} - polyrythme ${targetRatio}). Rapport : ${currentRatio} (T ∝ √L)`;
      }
      return `Cible : polyrythme ${targetRatio}. Pendule A : ${lengthA}cm, B : ${lengthB}cm. Rapport : ${currentRatio}. Rappel : rapport de longueur = (rapport)² !`;
    },
    formatHitSuccess: (step, total) => `✨ Étape ${step} sur ${total} Réussie !`,
    units: {
      cm: 'cm',
      m: 'm',
      g: 'g',
      bpm: 'BPM',
      sec: 's',
      deg: '°'
    }
  }
};

export const getTranslations = createI18nResolver<PendulumTranslations>(DICTIONARY, 'en');
