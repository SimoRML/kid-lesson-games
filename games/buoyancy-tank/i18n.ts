import { createI18nResolver } from '../../src/core/i18n.js';

export type SupportedLocale = 'en' | 'fr';

export interface BuoyancyTranslations {
  title: string;
  level: string;
  score: string;
  reset: string;
  soundOn: string;
  soundOff: string;
  trayLabel: string;
  tankLabel: string;
  submarineLabel: string;
  wellDone: string;
  summary: string;
  units: {
    ml: string;
    cm3: string;
    g: string;
    density: string;
    gPerCm3: string;
    liter: string;
  };
  fluids: {
    freshwater: string;
    saltwater: string;
  };
  formatPreschoolPrompt: (
    targetCategory: 'float' | 'sink',
    placedCount: number,
    requiredCount: number,
    lastAction?: { behavior: 'float' | 'sink'; name: string }
  ) => string;
  formatElementaryPrompt: (
    v0: number,
    vTarget: number,
    vCurrent: number,
    deltaNeeded: number,
    displaced: number
  ) => string;
  formatUpperElementaryPrompt: (
    fluidName: string,
    rhoFluid: number,
    totalMass: number,
    totalVolume: number,
    rhoSub: number,
    status: 'floats' | 'sinks' | 'neutral'
  ) => string;
  hintOverfill: (currentMl: number, targetMl: number) => string;
  hintUnderfill: (remainingMl: number) => string;
  hintSubTooDense: (currentRho: number, targetRho: number) => string;
  hintSubTooLight: (currentRho: number, targetRho: number) => string;
  hintSuccess: (summaryText: string) => string;
}

export const DICTIONARY: Record<SupportedLocale, BuoyancyTranslations> = {
  en: {
    title: '🌊 Buoyancy Tank & Density Lab',
    level: 'Level',
    score: 'Score',
    reset: 'Clear Tank',
    soundOn: '🔊 Sound ON',
    soundOff: '🔇 Sound OFF',
    trayLabel: 'Object Tray',
    tankLabel: 'Water Tank',
    submarineLabel: 'Submersible Pod',
    wellDone: '✨ Equilibrium Achieved!',
    summary: 'Mastered volume displacement, Archimedes buoyant force & submarine density trim!',
    units: {
      ml: 'mL',
      cm3: 'cm³',
      g: 'g',
      density: 'g/cm³',
      gPerCm3: 'g/cm³',
      liter: 'L'
    },
    fluids: {
      freshwater: 'Freshwater (1.00 g/cm³)',
      saltwater: 'Saltwater (1.20 g/cm³)'
    },
    formatPreschoolPrompt: (targetCategory, placedCount, requiredCount, lastAction) => {
      if (placedCount === 0) {
        return targetCategory === 'float'
          ? 'Which objects FLOAT on water? Drop the buoyant items into the tank!'
          : 'Which objects SINK to the bottom? Drop the heavy items into the tank!';
      }
      if (lastAction && lastAction.behavior !== targetCategory) {
        return `Oops! ${lastAction.name} is ${lastAction.behavior === 'sink' ? 'sinking to the bottom' : 'floating on top'}! Tap it in the tank to remove it.`;
      }
      if (placedCount < requiredCount) {
        return `Good job! (${placedCount}/${requiredCount}) items in water. Find ${requiredCount - placedCount} more!`;
      }
      return '✨ Splendid! All required items are resting in equilibrium!';
    },
    formatElementaryPrompt: (v0, vTarget, vCurrent, deltaNeeded, displaced) => {
      if (displaced === 0) {
        return `Water is at ${v0} mL. Target is ${vTarget} mL (Need +${deltaNeeded} mL). Combine blocks from the tray!`;
      }
      if (vCurrent < vTarget) {
        const rem = vTarget - vCurrent;
        return `Water: ${vCurrent} mL / ${vTarget} mL (+${displaced} mL added). Need +${rem} mL more!`;
      }
      if (vCurrent > vTarget) {
        const over = vCurrent - vTarget;
        return `Water too high! ${vCurrent} mL > ${vTarget} mL (+${over} mL overshoot). Tap a block to remove it!`;
      }
      return `✨ Exact displacement! ${displaced} cm³ of blocks raised water to ${vTarget} mL!`;
    },
    formatUpperElementaryPrompt: (fluidName, rhoFluid, totalMass, totalVolume, rhoSub, status) => {
      if (status === 'neutral') {
        return `✨ Neutral Buoyancy! m = ${totalMass} g / V = ${totalVolume} cm³ ⟹ ρ = ${rhoSub.toFixed(2)} g/cm³ matches ${fluidName}!`;
      }
      if (status === 'floats') {
        return `Pod floats too high! ρ = ${rhoSub.toFixed(2)} < ${rhoFluid.toFixed(2)} g/cm³ (m = ${totalMass} g, V = ${totalVolume} cm³). Add heavy ballast to sink!`;
      }
      return `Pod sinks to bottom! ρ = ${rhoSub.toFixed(2)} > ${rhoFluid.toFixed(2)} g/cm³ (m = ${totalMass} g, V = ${totalVolume} cm³). Add buoyant foam to float!`;
    },
    hintOverfill: (currentMl, targetMl) => `Water level (${currentMl} mL) exceeds target (${targetMl} mL). Tap an item to return it to the tray.`,
    hintUnderfill: (remainingMl) => `Need +${remainingMl} mL more to reach the target line.`,
    hintSubTooDense: (currentRho, targetRho) => `Submarine is too dense (${currentRho.toFixed(2)} > ${targetRho.toFixed(2)} g/cm³). Add foam blocks to reduce density.`,
    hintSubTooLight: (currentRho, targetRho) => `Submarine is too light (${currentRho.toFixed(2)} < ${targetRho.toFixed(2)} g/cm³). Add ballast weights to increase density.`,
    hintSuccess: (summaryText) => `✨ ${summaryText}`
  },
  fr: {
    title: '🌊 Cuve de Poussée d\'Archimède',
    level: 'Niveau',
    score: 'Score',
    reset: 'Vider la cuve',
    soundOn: '🔊 Son ACTIF',
    soundOff: '🔇 Son COUPÉ',
    trayLabel: 'Plateau d\'objets',
    tankLabel: 'Cuve d\'eau',
    submarineLabel: 'Module Sous-marin',
    wellDone: '✨ Équilibre atteint !',
    summary: 'Maîtrise du déplacement de volume, de la poussée d\'Archimède et de la flottabilité sous-marine !',
    units: {
      ml: 'mL',
      cm3: 'cm³',
      g: 'g',
      density: 'g/cm³',
      gPerCm3: 'g/cm³',
      liter: 'L'
    },
    fluids: {
      freshwater: 'Eau douce (1,00 g/cm³)',
      saltwater: 'Eau salée (1,20 g/cm³)'
    },
    formatPreschoolPrompt: (targetCategory, placedCount, requiredCount, lastAction) => {
      if (placedCount === 0) {
        return targetCategory === 'float'
          ? 'Quels objets FLOTTENT sur l\'eau ? Dépose les objets flottants dans la cuve !'
          : 'Quels objets COULENT au fond ? Dépose les objets lourds dans la cuve !';
      }
      if (lastAction && lastAction.behavior !== targetCategory) {
        return `Oups ! ${lastAction.name} ${lastAction.behavior === 'sink' ? 'coule au fond' : 'flotte à la surface'} ! Touche-le dans la cuve pour le retirer.`;
      }
      if (placedCount < requiredCount) {
        return `Très bien ! (${placedCount}/${requiredCount}) objets dans l'eau. Trouve-en encore ${requiredCount - placedCount} !`;
      }
      return '✨ Bravo ! Tous les objets requis sont en équilibre !';
    },
    formatElementaryPrompt: (v0, vTarget, vCurrent, deltaNeeded, displaced) => {
      if (displaced === 0) {
        return `L'eau est à ${v0} mL. Cible : ${vTarget} mL (+${deltaNeeded} mL requis). Combine les blocs du plateau !`;
      }
      if (vCurrent < vTarget) {
        const rem = vTarget - vCurrent;
        return `Niveau d'eau : ${vCurrent} mL / ${vTarget} mL (+${displaced} mL ajoutés). Il manque +${rem} mL !`;
      }
      if (vCurrent > vTarget) {
        const over = vCurrent - vTarget;
        return `Trop d'eau ! ${vCurrent} mL > ${vTarget} mL (+${over} mL en trop). Touche un bloc pour le retirer !`;
      }
      return `✨ Déplacement parfait ! ${displaced} cm³ de blocs ont élevé l'eau à ${vTarget} mL !`;
    },
    formatUpperElementaryPrompt: (fluidName, rhoFluid, totalMass, totalVolume, rhoSub, status) => {
      if (status === 'neutral') {
        return `✨ Flottabilité neutre ! m = ${totalMass} g / V = ${totalVolume} cm³ ⟹ ρ = ${rhoSub.toFixed(2)} g/cm³ équivaut à l'${fluidName} !`;
      }
      if (status === 'floats') {
        return `Le sous-marin flotte trop haut ! ρ = ${rhoSub.toFixed(2)} < ${rhoFluid.toFixed(2)} g/cm³ (m = ${totalMass} g, V = ${totalVolume} cm³). Ajoute du lest lourd !`;
      }
      return `Le sous-marin coule au fond ! ρ = ${rhoSub.toFixed(2)} > ${rhoFluid.toFixed(2)} g/cm³ (m = ${totalMass} g, V = ${totalVolume} cm³). Ajoute des flotteurs en mousse !`;
    },
    hintOverfill: (currentMl, targetMl) => `Le niveau d'eau (${currentMl} mL) dépasse la cible (${targetMl} mL). Touche un bloc pour le retirer.`,
    hintUnderfill: (remainingMl) => `Il manque +${remainingMl} mL pour atteindre la ligne cible.`,
    hintSubTooDense: (currentRho, targetRho) => `Sous-marin trop dense (${currentRho.toFixed(2)} > ${targetRho.toFixed(2)} g/cm³). Ajoute de la mousse.`,
    hintSubTooLight: (currentRho, targetRho) => `Sous-marin trop léger (${currentRho.toFixed(2)} < ${targetRho.toFixed(2)} g/cm³). Ajoute du lest.`,
    hintSuccess: (summaryText) => `✨ ${summaryText}`
  }
};

export const getTranslations = createI18nResolver(DICTIONARY, 'en');
