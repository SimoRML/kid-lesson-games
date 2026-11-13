import { createI18nResolver } from '../../src/core/i18n.js';

export type SupportedLocale = 'en' | 'fr';
export type RotationDirection = 'cw' | 'ccw';

export interface GearTranslations {
  title: string;
  level: string;
  score: string;
  reset: string;
  soundOn: string;
  soundOff: string;
  trayLabel: string;
  motorLabel: string;
  targetDialLabel: string;
  windmillLabel: string;
  clockwise: string;
  counterClockwise: string;
  cwShort: string;
  ccwShort: string;
  directionLabels: {
    cw: string;
    ccw: string;
  };
  units: {
    rpm: string;
    teeth: string;
    ratio: string;
  };
  wellDone: string;
  summary: string;
  jammedAlert: string;
  formatPreschoolPrompt: (connected: boolean, placedGears: number, totalSlots: number) => string;
  formatElementaryPrompt: (
    currentRpm: number,
    currentDir: RotationDirection | null,
    targetRpm: number,
    targetDir: RotationDirection,
    isConnected: boolean
  ) => string;
  formatUpperElementaryPrompt: (
    currentRpm: number,
    currentDir: RotationDirection | null,
    targetRpm: number,
    targetDir: RotationDirection,
    ratioStr: string,
    lcm: number,
    isConnected: boolean
  ) => string;
  hintDirectionMismatch: (currentDir: RotationDirection, targetDir: RotationDirection) => string;
  hintSpeedMismatch: (currentRpm: number, targetRpm: number) => string;
  hintSuccess: (rpm: number, dir: RotationDirection, ratio?: string) => string;
}

export const DICTIONARY: Record<SupportedLocale, GearTranslations> = {
  en: {
    title: '⚙️ Gear Trains',
    level: 'Level',
    score: 'Score',
    reset: 'Clear Gears',
    soundOn: '🔊 Sound ON',
    soundOff: '🔇 Sound OFF',
    trayLabel: 'Gear Inventory',
    motorLabel: 'Motor',
    targetDialLabel: 'Target Dial',
    windmillLabel: 'Windmill',
    clockwise: 'Clockwise',
    counterClockwise: 'Counter-Clockwise',
    cwShort: 'CW',
    ccwShort: 'CCW',
    directionLabels: {
      cw: 'Clockwise',
      ccw: 'Counter-Clockwise'
    },
    units: {
      rpm: 'RPM',
      teeth: 'teeth',
      ratio: 'ratio'
    },
    wellDone: '✨ Mechanism Whirring in Harmony!',
    summary: 'Mastered gear ratios, rotational directions & LCM speed mechanics!',
    jammedAlert: '⚠️ Gears are jammed! Check for 3-way lock or conflicting rotation.',
    formatPreschoolPrompt: (connected, placed, total) => {
      if (!connected && placed === 0) {
        return 'Place colorful gears on the pegs to spin the windmill!';
      }
      if (!connected) {
        return `Gears placed (${placed}/${total})! Connect the remaining pegs to the windmill!`;
      }
      return '✨ The windmill is spinning happily!';
    },
    formatElementaryPrompt: (currentRpm, currentDir, targetRpm, targetDir, isConnected) => {
      const dirText = targetDir === 'cw' ? 'Clockwise' : 'Counter-Clockwise';
      if (!isConnected) {
        return `Connect gears from motor to dial! Target: ${targetRpm} RPM ${dirText}.`;
      }
      const curDirText = currentDir === 'cw' ? 'Clockwise' : 'Counter-Clockwise';
      if (currentDir !== targetDir) {
        return `Connected! Direction is ${curDirText} (Target: ${dirText}). An even gear count reverses direction!`;
      }
      if (Math.abs(currentRpm - targetRpm) > 0.5) {
        return `Connected! Speed is ${Math.round(currentRpm)} RPM (Target: ${targetRpm} RPM). Change gear sizes!`;
      }
      return `✨ Perfect match! ${Math.round(currentRpm)} RPM ${curDirText}!`;
    },
    formatUpperElementaryPrompt: (currentRpm, currentDir, targetRpm, targetDir, ratioStr, lcm, isConnected) => {
      const dirText = targetDir === 'cw' ? 'CW' : 'CCW';
      if (!isConnected) {
        return `Target: ${targetRpm} RPM ${dirText}. Match tooth ratios and account for gear count parity!`;
      }
      const curDirText = currentDir === 'cw' ? 'CW' : 'CCW';
      if (currentDir !== targetDir || Math.abs(currentRpm - targetRpm) > 0.5) {
        return `Current: ${Math.round(currentRpm)} RPM ${curDirText} / Target: ${targetRpm} RPM ${dirText} (Ratio ${ratioStr}).`;
      }
      return `✨ Clockwork Synced! Ratio ${ratioStr} | ${Math.round(currentRpm)} RPM ${curDirText} | LCM = ${lcm} teeth!`;
    },
    hintDirectionMismatch: (currentDir, targetDir) =>
      `Direction mismatch: currently ${currentDir === 'cw' ? 'Clockwise' : 'Counter-Clockwise'} vs target ${targetDir === 'cw' ? 'Clockwise' : 'Counter-Clockwise'}. Add/remove a gear to flip direction!`,
    hintSpeedMismatch: (currentRpm, targetRpm) =>
      `Speed mismatch: currently ${Math.round(currentRpm)} RPM vs target ${targetRpm} RPM.`,
    hintSuccess: (rpm, dir, ratio) =>
      ratio
        ? `✨ Perfectly tuned: ${Math.round(rpm)} RPM ${dir.toUpperCase()} (Ratio ${ratio})!`
        : `✨ Perfectly tuned: ${Math.round(rpm)} RPM ${dir.toUpperCase()}!`
  },
  fr: {
    title: '⚙️ Trains d’Engrenages',
    level: 'Niveau',
    score: 'Score',
    reset: 'Vider le plateau',
    soundOn: '🔊 Son ACTIVÉ',
    soundOff: '🔇 Son DÉSACTIVÉ',
    trayLabel: 'Inventaire d’engrenages',
    motorLabel: 'Moteur',
    targetDialLabel: 'Cadran cible',
    windmillLabel: 'Moulin à vent',
    clockwise: 'Sens horaire',
    counterClockwise: 'Sens anti-horaire',
    cwShort: 'SH',
    ccwShort: 'SAH',
    directionLabels: {
      cw: 'Sens horaire',
      ccw: 'Sens anti-horaire'
    },
    units: {
      rpm: 'tr/min',
      teeth: 'dents',
      ratio: 'rapport'
    },
    wellDone: '✨ Mécanisme en Parfaite Harmonie !',
    summary: 'Engrenages, sens de rotation et rapports de vitesse maîtrisés !',
    jammedAlert: '⚠️ Les engrenages sont bloqués ! Vérifie les boucles impaires.',
    formatPreschoolPrompt: (connected, placed, total) => {
      if (!connected && placed === 0) {
        return 'Place des engrenages colorés sur les piquets pour faire tourner le moulin !';
      }
      if (!connected) {
        return `Engrenages placés (${placed}/${total}) ! Relie les piquets restants jusqu’au moulin !`;
      }
      return '✨ Le moulin tourne joyeusement !';
    },
    formatElementaryPrompt: (currentRpm, currentDir, targetRpm, targetDir, isConnected) => {
      const dirText = targetDir === 'cw' ? 'Sens horaire' : 'Sens anti-horaire';
      if (!isConnected) {
        return `Relie le moteur au cadran ! Cible : ${targetRpm} tr/min ${dirText}.`;
      }
      const curDirText = currentDir === 'cw' ? 'Sens horaire' : 'Sens anti-horaire';
      if (currentDir !== targetDir) {
        return `Connecté ! Sens : ${curDirText} (Cible : ${dirText}). Un nombre pair d’engrenages inverse le sens !`;
      }
      if (Math.abs(currentRpm - targetRpm) > 0.5) {
        return `Connecté ! Vitesse : ${Math.round(currentRpm)} tr/min (Cible : ${targetRpm} tr/min). Ajuste les tailles !`;
      }
      return `✨ Équilibre réussi ! ${Math.round(currentRpm)} tr/min ${curDirText} !`;
    },
    formatUpperElementaryPrompt: (currentRpm, currentDir, targetRpm, targetDir, ratioStr, lcm, isConnected) => {
      const dirText = targetDir === 'cw' ? 'SH' : 'SAH';
      if (!isConnected) {
        return `Cible : ${targetRpm} tr/min ${dirText}. Calcule le rapport de dents et la parité !`;
      }
      const curDirText = currentDir === 'cw' ? 'SH' : 'SAH';
      if (currentDir !== targetDir || Math.abs(currentRpm - targetRpm) > 0.5) {
        return `Actuel : ${Math.round(currentRpm)} tr/min ${curDirText} / Cible : ${targetRpm} tr/min ${dirText} (Rapport ${ratioStr}).`;
      }
      return `✨ Horlogerie Synchronisée ! Rapport ${ratioStr} | ${Math.round(currentRpm)} tr/min ${curDirText} | PPCM = ${lcm} dents !`;
    },
    hintDirectionMismatch: (currentDir, targetDir) =>
      `Sens incorrect : actuellement ${currentDir === 'cw' ? 'Sens horaire' : 'Sens anti-horaire'} contre cible ${targetDir === 'cw' ? 'Sens horaire' : 'Sens anti-horaire'}. Ajoute/retire un engrenage !`,
    hintSpeedMismatch: (currentRpm, targetRpm) =>
      `Vitesse incorrecte : actuellement ${Math.round(currentRpm)} tr/min contre ${targetRpm} tr/min cibles.`,
    hintSuccess: (rpm, dir, ratio) =>
      ratio
        ? `✨ Parfaitement réglé : ${Math.round(rpm)} tr/min ${dir === 'cw' ? 'SH' : 'SAH'} (Rapport ${ratio}) !`
        : `✨ Parfaitement réglé : ${Math.round(rpm)} tr/min ${dir === 'cw' ? 'SH' : 'SAH'} !`
  }
};

export const getTranslations = createI18nResolver<GearTranslations>(DICTIONARY, 'en');
