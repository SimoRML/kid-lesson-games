import { describe, expect, it } from 'vitest';
import { getTranslations } from './i18n.js';

describe('i18n Translations', () => {
  it('returns English translations by default or when locale is "en"', () => {
    const en = getTranslations('en');
    expect(en.title).toBe('⚖️ Balance Lab');
    expect(en.level).toBe('Level');
    expect(en.yourWeights).toBe('Your Metric Weights');
    expect(en.rightHookLabel).toBe('Right Hook Notch:');
    expect(en.reset).toBe('New Puzzle');
    expect(en.soundOn).toBe('🔊 Sound ON');
    expect(en.soundOff).toBe('🔇 Sound OFF');

    const fallback = getTranslations('de');
    expect(fallback.title).toBe('⚖️ Balance Lab');
  });

  it('returns French translations when locale is "fr"', () => {
    const fr = getTranslations('fr');
    expect(fr.title).toBe('⚖️ Labo d’Équilibre');
    expect(fr.level).toBe('Niveau');
    expect(fr.yourWeights).toBe('Vos Poids Métriques');
    expect(fr.rightHookLabel).toBe('Cran du crochet droit :');
    expect(fr.reset).toBe('Nouveau Défi');
    expect(fr.soundOn).toBe('🔊 Son ACTIF');
    expect(fr.soundOff).toBe('🔇 Son COUPÉ');
  });

  it('formats standard balance instructions properly in en and fr', () => {
    const en = getTranslations('en');
    const fr = getTranslations('fr');

    const enInstruction = en.formatStandardInstruction('500g + 250g', 750, 0);
    expect(enInstruction).toContain('Balance 500g + 250g (750g)');

    const enSubInstruction = en.formatStandardInstruction('1000g', 1000, 250);
    expect(enSubInstruction).toContain('Add 750g using different weights!');
    expect(enSubInstruction).toContain('1 kg (1000g)');

    // Non-even metric kg formatting (e.g. 1250g)
    const enKgInstruction = en.formatStandardInstruction('1250g', 1250, 0);
    expect(enKgInstruction).toContain('1.25 kg (1250g)');

    const frInstruction = fr.formatStandardInstruction('500g + 250g', 750, 0);
    expect(frInstruction).toContain('Équilibrez 500g + 250g');

    const frSubInstruction = fr.formatStandardInstruction('1000g', 1000, 250);
    expect(frSubInstruction).toContain('Ajoutez 750g avec d\'autres poids !');
  });

  it('formats lever Archimedes instructions properly in en and fr', () => {
    const en = getTranslations('en');
    const fr = getTranslations('fr');

    const enLever = en.formatLeverInstruction(300, 4, 1200, 3);
    expect(enLever).toContain('Left torque: 300g × 4 = 1200');
    expect(enLever).toContain('At right notch 3, you need 400g');
    expect(enLever).toContain('(400 × 3 = 1200)');

    // Test non-integer division reminder branch
    const enNonDiv = en.formatLeverInstruction(250, 3, 750, 4);
    expect(enNonDiv).toContain('divides 750 evenly');

    const frLever = fr.formatLeverInstruction(300, 4, 1200, 2);
    expect(frLever).toContain('Force à gauche : 300g × 4 = 1200');
    expect(frLever).toContain('Au cran 2, il faut 600g');

    const frNonDiv = fr.formatLeverInstruction(250, 3, 750, 4);
    expect(frNonDiv).toContain('Déplacez le crochet sur un cran qui divise 750');
  });
});
