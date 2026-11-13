import { createI18nResolver } from '../../src/core/i18n.js';

export type SupportedLocale = 'en' | 'fr';

/** Directional feedback when the swing does not match the metronome (never gives the answer). */
export type SyncHint = 'fast' | 'slow' | 'offbeat';

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
  presetsLabel: string;
  lengthLabel: string;
  massLabel: string;
  pendulumBLengthLabel: string;
  polyrhythmRatioLabel: string;
  formatPreschoolPrompt: (
    angleDeg: number,
    blocksRemaining: number,
    phase?: 'aim' | 'swinging'
  ) => string;
  formatElementaryPrompt: (
    bpm: number,
    streak: number,
    targetStreak: number,
    sync?: SyncHint | null,
    massChanged?: boolean
  ) => string;
  formatUpperPrompt: (
    targetRatio: string,
    lengthA: number,
    lengthB: number,
    currentRatio: string,
    coincidences: number,
    targetCoincidences: number,
    lengthRule?: string
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
    massNote: 'Mass: {mass}g',
    lengthNote: 'Length: {length}cm',
    streakProgress: 'Beat Match: {count}/{target}',
    ratioCurrent: 'Current Ratio: {current} | Target: {target}',
    releaseBoth: 'Release Together',
    resetBlocks: 'Reset Blocks',
    resetSwing: 'Reset Swing',
    gentlePreset: 'Gentle (20°)',
    mediumPreset: 'Medium (40°)',
    smashPreset: 'Smash! (60°)',
    presetsLabel: 'Presets:',
    lengthLabel: 'Length:',
    massLabel: 'Mass:',
    pendulumBLengthLabel: 'Pendulum B Length:',
    polyrhythmRatioLabel: 'Polyrhythm Ratio',
    formatPreschoolPrompt: (angleDeg: number, blocksRemaining: number, phase = 'aim') => {
      if (blocksRemaining === 0) {
        return '💥 Fantastic smash! All blocks tumbled over!';
      }
      if (phase === 'swinging') {
        return `Whoosh! Watch the ball swing and hit ${blocksRemaining} block${blocksRemaining > 1 ? 's' : ''}!`;
      }
      if (angleDeg < 10) {
        return `Pull back the ball and let go to knock over ${blocksRemaining} block${blocksRemaining > 1 ? 's' : ''}!`;
      }
      if (angleDeg < 35) {
        return `Angle: ${angleDeg}° — Pull a bit higher for maximum smash power!`;
      }
      return `Angle: ${angleDeg}° — High power! Release to smash!`;
    },
    formatElementaryPrompt: (bpm, streak, targetStreak, sync = null, massChanged = false) => {
      if (streak >= targetStreak) {
        return massChanged
          ? `✨ Perfect tempo lock at ${bpm} BPM! You changed the mass and the swing speed stayed the same!`
          : `✨ Perfect tempo lock at ${bpm} BPM! Next time, try a different mass: what changes?`;
      }
      if (streak > 0) {
        return `🔥 In sync! Beat match streak: ${streak}/${targetStreak} (${bpm} BPM)! Keep swinging!`;
      }
      if (sync === 'fast') {
        return `Match the ${bpm} BPM beat! Your pendulum is swinging faster than the beat.`;
      }
      if (sync === 'slow') {
        return `Match the ${bpm} BPM beat! Your pendulum is swinging slower than the beat.`;
      }
      if (sync === 'offbeat') {
        return `Match the ${bpm} BPM beat! The speed is close, but the swings miss the beat. Try Reset Swing.`;
      }
      return massChanged
        ? `Match the ${bpm} BPM beat! What did changing the mass do to the swing?`
        : `Match the ${bpm} BPM beat! What happens if you change the mass? Or the string?`;
    },
    formatUpperPrompt: (targetRatio, lengthA, lengthB, currentRatio, coincidences, targetCoincidences, lengthRule) => {
      if (coincidences >= targetCoincidences) {
        return `✨ Locked in harmony! ${targetRatio} polyrhythm validated!${lengthRule ? ` The length ratio is the square of the swing ratio: ${lengthRule}.` : ''}`;
      }
      if (coincidences > 0) {
        return `🎶 Coincidence hit! (${coincidences}/${targetCoincidences} - ${targetRatio} polyrhythm). Swing ratio A:B now: ${currentRatio}`;
      }
      return `Target: ${targetRatio} polyrhythm. Pendulum A: ${lengthA}cm, B: ${lengthB}cm. Swing ratio A:B now: ${currentRatio}.`;
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
    massNote: 'Masse : {mass}g',
    lengthNote: 'Longueur : {length}cm',
    streakProgress: 'Synchronisation : {count}/{target}',
    ratioCurrent: 'Rapport actuel : {current} | Cible : {target}',
    releaseBoth: 'Lâcher ensemble',
    resetBlocks: 'Réinitialiser les blocs',
    resetSwing: 'Réinitialiser le pendule',
    gentlePreset: 'Doux (20°)',
    mediumPreset: 'Moyen (40°)',
    smashPreset: 'Écraser ! (60°)',
    presetsLabel: 'Préréglages :',
    lengthLabel: 'Longueur :',
    massLabel: 'Masse :',
    pendulumBLengthLabel: 'Longueur du pendule B :',
    polyrhythmRatioLabel: 'Polyrythme',
    formatPreschoolPrompt: (angleDeg: number, blocksRemaining: number, phase = 'aim') => {
      if (blocksRemaining === 0) {
        return '💥 Renversement spectaculaire ! Tous les blocs sont tombés !';
      }
      if (phase === 'swinging') {
        return `Houla ! Regarde la boule balancer et frapper ${blocksRemaining} bloc${blocksRemaining > 1 ? 's' : ''} !`;
      }
      if (angleDeg < 10) {
        return `Tire la boule en arrière et lâche-la pour faire tomber ${blocksRemaining} bloc${blocksRemaining > 1 ? 's' : ''} !`;
      }
      if (angleDeg < 35) {
        return `Angle : ${angleDeg}° — Tire un peu plus haut pour plus de force d'impact !`;
      }
      return `Angle : ${angleDeg}° — Pleine puissance ! Lâche pour frapper !`;
    },
    formatElementaryPrompt: (bpm, streak, targetStreak, sync = null, massChanged = false) => {
      if (streak >= targetStreak) {
        return massChanged
          ? `✨ Synchronisation parfaite à ${bpm} BPM ! Tu as changé la masse et la vitesse du balancement est restée la même !`
          : `✨ Synchronisation parfaite à ${bpm} BPM ! La prochaine fois, essaie une autre masse : qu'est-ce qui change ?`;
      }
      if (streak > 0) {
        return `🔥 En rythme ! Série de synchronisation : ${streak}/${targetStreak} (${bpm} BPM) !`;
      }
      if (sync === 'fast') {
        return `Ajuste au rythme de ${bpm} BPM ! Ton pendule balance plus vite que le rythme.`;
      }
      if (sync === 'slow') {
        return `Ajuste au rythme de ${bpm} BPM ! Ton pendule balance plus lentement que le rythme.`;
      }
      if (sync === 'offbeat') {
        return `Ajuste au rythme de ${bpm} BPM ! La vitesse est proche, mais les oscillations ratent le rythme. Essaie « Réinitialiser le pendule ».`;
      }
      return massChanged
        ? `Ajuste au rythme de ${bpm} BPM ! Qu'a changé la masse sur le balancement ?`
        : `Ajuste au rythme de ${bpm} BPM ! Que se passe-t-il si tu changes la masse ? Ou la ficelle ?`;
    },
    formatUpperPrompt: (targetRatio, lengthA, lengthB, currentRatio, coincidences, targetCoincidences, lengthRule) => {
      if (coincidences >= targetCoincidences) {
        return `✨ Harmonie verrouillée ! Polyrythme ${targetRatio} validé !${lengthRule ? ` Le rapport des longueurs est le carré du rapport des oscillations : ${lengthRule}.` : ''}`;
      }
      if (coincidences > 0) {
        return `🎶 Coïncidence harmonique ! (${coincidences}/${targetCoincidences} - polyrythme ${targetRatio}). Rapport A:B actuel : ${currentRatio}`;
      }
      return `Cible : polyrythme ${targetRatio}. Pendule A : ${lengthA}cm, B : ${lengthB}cm. Rapport A:B actuel : ${currentRatio}.`;
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
