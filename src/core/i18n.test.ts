import { describe, expect, it } from 'vitest';
import { createI18nResolver, I18nManager, interpolate } from './i18n.js';

describe('I18nManager Core Utility', () => {
  it('normalizes locale codes', () => {
    const i18n = new I18nManager('en-US');
    expect(i18n.normalizeLocale('fr-FR')).toBe('fr');
    expect(i18n.normalizeLocale('EN_gb')).toBe('en');
    expect(i18n.normalizeLocale('')).toBe('en');
  });

  it('translates core UI tokens with fallback', () => {
    const en = new I18nManager('en');
    expect(en.t('soundOn')).toBe('🔊 Sound ON');
    expect(en.t('soundOff')).toBe('🔇 Sound OFF');
    expect(en.t('level')).toBe('Level');

    const fr = new I18nManager('fr');
    expect(fr.t('soundOn')).toBe('🔊 Son ACTIF');
    expect(fr.t('soundOff')).toBe('🔇 Son COUPÉ');
    expect(fr.t('level')).toBe('Niveau');
  });

  it('interpolates parameters into messages', () => {
    const str = interpolate('Hello {name}, your score is {score}!', { name: 'Lucas', score: 100 });
    expect(str).toBe('Hello Lucas, your score is 100!');
  });

  it('supports createI18nResolver for custom cartridge dictionaries', () => {
    const customDict = {
      en: { title: 'Math Puzzle', count: 'Count items' },
      fr: { title: 'Casse-tête Math', count: 'Comptez les objets' }
    };

    const resolver = createI18nResolver(customDict, 'en');
    expect(resolver('fr').title).toBe('Casse-tête Math');
    expect(resolver('en').title).toBe('Math Puzzle');
    expect(resolver('es').title).toBe('Math Puzzle'); // fallback
  });
});
