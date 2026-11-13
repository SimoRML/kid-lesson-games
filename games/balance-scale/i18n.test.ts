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

  it('formats standard instructions without duplicated totals or nested parentheses', () => {
    const en = getTranslations('en');
    const fr = getTranslations('fr');

    // Single weight < 1 kg: no repeated total
    expect(en.formatStandardInstruction('750g', 750, 0, 1)).toBe('Balance 750g using a different combination of weights!');
    expect(fr.formatStandardInstruction('750g', 750, 0, 1)).toBe('Équilibrez 750g avec une combinaison différente de poids !');

    // Single 1 kg weight: no "(1000g)" and no nesting
    const enKg = en.formatStandardInstruction('1 kg', 1000, 0, 1);
    expect(enKg).toBe('Balance 1 kg using a different combination of weights!');
    expect(fr.formatStandardInstruction('1 kg', 1000, 0, 1)).toBe('Équilibrez 1 kg avec une combinaison différente de poids !');

    // Multiple weights: total shown once
    expect(en.formatStandardInstruction('600g + 400g', 1000, 0, 2)).toBe('Balance 600g + 400g (1 kg) using a different combination of weights!');
    expect(fr.formatStandardInstruction('600g + 400g', 1000, 0, 2)).toContain('600g + 400g (1 kg)');
    expect(en.formatStandardInstruction('500g + 750g', 1250, 0)).toContain('(1.25 kg)');
    expect(fr.formatStandardInstruction('500g + 750g', 1250, 0)).toContain('(1,25 kg)');

    for (const out of [
      enKg,
      en.formatStandardInstruction('1 kg', 1000, 250, 1),
      fr.formatStandardInstruction('1 kg', 1000, 250, 1),
      en.formatStandardInstruction('600g + 400g', 1000, 0, 2),
      fr.formatStandardInstruction('500g + 750g', 1250, 0, 2)
    ]) {
      expect(out).not.toMatch(/\([^)]*\(/);
      expect(out).not.toContain('1000g');
    }

    // Right pan pre-filled
    expect(en.formatStandardInstruction('1 kg', 1000, 250, 1)).toBe('Left has 1 kg, right has 250g. Add 750g using different weights!');
    expect(fr.formatStandardInstruction('1 kg', 1000, 250, 1)).toContain("Ajoutez 750g avec d'autres poids !");
  });

  it('formats lever instructions with the rule but never the needed grams', () => {
    const en = getTranslations('en');
    const fr = getTranslations('fr');

    const enLever = en.formatLeverInstruction(200, 4, 800, 2);
    expect(enLever).toBe('Left: 200g × 4 = 800. Make the right side equal 800!');
    expect(enLever).not.toContain('400g');
    const frLever = fr.formatLeverInstruction(200, 4, 800, 2);
    expect(frLever).toContain('Gauche : 200g × 4 = 800');
    expect(frLever).not.toContain('400g');

    // Never leaks needed grams at any notch
    for (const notch of [1, 2, 3, 4]) {
      const torque = 1200;
      if (torque % notch !== 0) continue;
      const needed = `${torque / notch}g`;
      expect(en.formatLeverInstruction(150, 8, torque, notch)).not.toContain(needed);
      expect(fr.formatLeverInstruction(150, 8, torque, notch)).not.toContain(needed);
    }

    // Non-integer division reminder branch
    expect(en.formatLeverInstruction(250, 3, 750, 4)).toContain('divides 750 evenly');
    expect(fr.formatLeverInstruction(250, 3, 750, 4)).toContain('qui divise 750');
  });

  it('formats live standard progress hints in en and fr without stating the missing amount', () => {
    const en = getTranslations('en');
    const fr = getTranslations('fr');

    expect(en.formatStandardLive(500, 750)).toBe('Right: 500g of 750g, keep going!');
    expect(en.formatStandardLive(500, 750)).not.toContain('250');
    expect(en.formatStandardLive(1250, 1000)).toContain('1.25 kg is too heavy');
    expect(en.formatStandardLive(750, 750)).toContain('balanced');
    expect(fr.formatStandardLive(500, 750)).toBe('Droite : 500g sur 750g, continuez !');
    expect(fr.formatStandardLive(1250, 1000)).toContain('trop lourd');
    expect(fr.formatStandardLive(750, 750)).toContain('Équilibre parfait');
  });

  it('formats live lever progress hints in en and fr', () => {
    const en = getTranslations('en');
    const fr = getTranslations('fr');

    expect(en.formatLeverLive(300, 2, 800)).toBe('Right torque: 300g × 2 = 600 / 800. A little more!');
    expect(en.formatLeverLive(500, 2, 800)).toContain('Too heavy');
    expect(en.formatLeverLive(400, 2, 800)).toContain('balanced');
    expect(fr.formatLeverLive(300, 2, 800)).toBe('Force à droite : 300g × 2 = 600 / 800. Encore un peu !');
    expect(fr.formatLeverLive(500, 2, 800)).toContain('Trop lourd');
    expect(fr.formatLeverLive(400, 2, 800)).toContain('Équilibre parfait');
  });

  it('provides a translated notch label', () => {
    expect(getTranslations('en').notch).toBe('Notch');
    expect(getTranslations('fr').notch).toBe('Cran');
  });
});
