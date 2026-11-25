import { describe, expect, it } from 'vitest';
import { DICTIONARY, describeCounts, formatNumber, getTranslations, normalizeLocale } from './i18n.js';

describe('Candy Factory i18n', () => {
  it('EN and FR expose exactly the same keys', () => {
    expect(Object.keys(DICTIONARY.fr).sort()).toEqual(Object.keys(DICTIONARY.en).sort());
  });

  it('every string is non-empty and every formatter returns text in both languages', () => {
    for (const lang of ['en', 'fr'] as const) {
      const d = DICTIONARY[lang];
      for (const [key, value] of Object.entries(d)) {
        if (typeof value === 'string') expect(value.length, `${lang}.${key}`).toBeGreaterThan(0);
      }
      expect(d.levelWord('1', '6')).toContain('6');
      expect(d.countPrompt('Aya', '7')).toContain('Aya');
      expect(d.needCarry('15')).toContain('15');
      expect(d.truck('4 000')).toContain('4 000');
      expect(d.items.length).toBe(3);
      for (let c = 0; c < 5; c++) expect(d.columnName(c).length).toBeGreaterThan(0);
    }
  });

  it('resolves and normalizes locales, falling back to English', () => {
    expect(getTranslations('fr-FR').title).toBe('La Fabrique de Bonbons');
    expect(getTranslations('de').title).toBe('Candy Factory');
    expect(normalizeLocale('FR_ca')).toBe('fr');
    expect(normalizeLocale(42)).toBe('en');
  });

  it('formats numbers per locale and pluralizes place-value units', () => {
    expect(formatNumber(2458, 'en')).toBe('2,458');
    expect(formatNumber(2458, 'fr').replace(/\s/g, ' ')).toBe('2 458');
    const fmt = (n: number): string => String(n);
    expect(describeCounts(DICTIONARY.en, [12, 3], fmt)).toBe('3 bags + 12 candies');
    expect(describeCounts(DICTIONARY.fr, [1, 0, 1], fmt)).toBe('1 boîte + 1 bonbon');
    expect(describeCounts(DICTIONARY.en, [0, 0], fmt)).toBe('0 candies');
  });
});
