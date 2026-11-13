export type SupportedLocale = 'en' | 'fr';

export interface Translations {
  title: string;
  level: string;
  score: string;
  reset: string;
  soundOn: string;
  soundOff: string;
  yourWeights: string;
  wellDone: string;
  summary: string;
  instructions: {
    lvl1_3_5: string;
    lvl2_3_5: string;
    lvl1_6_8: string;
    lvl2_6_8: string;
    lvl3_6_8: string;
    lvl1_9_11: string;
    lvl2_9_11: string;
    lvl3_9_11: string;
  };
}

export const DICTIONARY: Record<SupportedLocale, Translations> = {
  en: {
    title: '⚖️ Balance Lab',
    level: 'Level',
    score: 'Score',
    reset: 'Reset',
    soundOn: '🔊 Sound ON',
    soundOff: '🔇 Sound OFF',
    yourWeights: 'Your Metric Weights',
    wellDone: '✨ Perfect Balance!',
    summary: 'Mastered balance, metric conversions & levers!',
    instructions: {
      lvl1_3_5: 'Make the scale even! Balance 200g.',
      lvl2_3_5: 'Left pan has 300g, right has 100g. Add weights to reach 300g!',
      lvl1_6_8: 'Conversion challenge: 1 kg = 1 000 g. Balance 1 kg with grams!',
      lvl2_6_8: 'Add weights to balance 750g on the scale.',
      lvl3_6_8: 'Left pan has 1 kg (1 000g). Right pan has 250g. What is missing?',
      lvl1_9_11: 'Lever Physics: 400g at notch 2 (400×2=800). Balance it with 200g at notch 4!',
      lvl2_9_11: 'Click a right-side notch (1–4) or add weights: Balance 600g at notch 2 (1200)!',
      lvl3_9_11: 'Master Lever: Left has 500g at notch 3 (1500). Click a notch & place weights to match 1500!'
    }
  },
  fr: {
    title: '⚖️ Labo d’Équilibre',
    level: 'Niveau',
    score: 'Score',
    reset: 'Réinitialiser',
    soundOn: '🔊 Son ACTIF',
    soundOff: '🔇 Son COUPÉ',
    yourWeights: 'Vos Poids Métriques',
    wellDone: '✨ Équilibre Parfait !',
    summary: 'Maîtrise de l’équilibre, des conversions et des leviers !',
    instructions: {
      lvl1_3_5: 'Équilibrez la balance ! Trouvez 200g.',
      lvl2_3_5: 'Gauche : 300g, Droite : 100g. Ajoutez des poids pour atteindre 300g !',
      lvl1_6_8: 'Défi conversion : 1 kg = 1 000 g. Équilibrez 1 kg avec des grammes !',
      lvl2_6_8: 'Ajoutez des poids pour équilibrer 750g sur la balance.',
      lvl3_6_8: 'Gauche : 1 kg (1 000g). Droite : 250g. Que manque-t-il ?',
      lvl1_9_11: 'Levier : 400g au cran 2 (400×2=800). Équilibrez avec 200g au cran 4 !',
      lvl2_9_11: 'Cliquez un cran à droite (1–4) ou ajoutez des poids : Équilibrez 600g au cran 2 (1200) !',
      lvl3_9_11: 'Maître Levier : 500g au cran 3 (1500). Choisissez un cran et les poids pour faire 1500 !'
    }
  }
};

export function getTranslations(locale?: string): Translations {
  if (locale && locale.startsWith('fr')) return DICTIONARY.fr;
  return DICTIONARY.en;
}
