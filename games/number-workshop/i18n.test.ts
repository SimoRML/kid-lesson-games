import { describe, expect, it } from 'vitest';
import { DICTIONARY, formatNumber, getTranslations, mistakesText, normalizeLocale } from './i18n.js';
import { FACTS_THEMES } from './levels.js';

describe('normalizeLocale', () => {
  it('reduces any value to en or fr', () => {
    expect(normalizeLocale('fr')).toBe('fr');
    expect(normalizeLocale('FR-ma')).toBe('fr');
    expect(normalizeLocale(' fr_CA ')).toBe('fr');
    expect(normalizeLocale('en-US')).toBe('en');
    for (const bad of ['', '<bad>', 'xx', undefined, null, 5, {}, ['fr']]) {
      expect(normalizeLocale(bad)).toBe('en');
    }
  });
});

describe('formatNumber', () => {
  it('groups digits per locale', () => {
    expect(formatNumber(60000, 'en')).toBe('60,000');
    expect(formatNumber(60000, 'fr').replace(/\s/g, ' ')).toBe('60 000');
    expect(formatNumber(789000, 'fr-FR').replace(/\s/g, ' ')).toBe('789 000');
    expect(formatNumber(7, 'en')).toBe('7');
  });

  it('never throws for a hostile locale', () => {
    expect(() => formatNumber(5, 'not a locale!!')).not.toThrow();
    expect(formatNumber(1000, 'not a locale!!')).toBe('1,000');
  });
});

describe('dictionary', () => {
  it('has identical keys in English and French', () => {
    expect(Object.keys(DICTIONARY.fr).sort()).toEqual(Object.keys(DICTIONARY.en).sort());
  });

  it('falls back to English for an unknown language', () => {
    expect(getTranslations('zz').title).toBe('Division Workshop');
    expect(getTranslations('fr-FR').title).toBe('Atelier de division');
  });

  it('names every theme with a singular and a plural', () => {
    for (const lang of ['en', 'fr'] as const) {
      const d = DICTIONARY[lang];
      for (const theme of FACTS_THEMES) {
        expect(d.noun(theme, 1).length).toBeGreaterThan(0);
        expect(d.noun(theme, 5)).not.toBe(d.noun(theme, 2) + 'x');
        expect(d.noun(theme, 5).length).toBeGreaterThan(0);
      }
    }
    expect(DICTIONARY.en.noun('dates', 1)).toBe('date');
    expect(DICTIONARY.en.noun('dates', 3)).toBe('dates');
    expect(DICTIONARY.fr.noun('apples', 0)).toBe('pomme');
    expect(DICTIONARY.fr.noun('apples', 2)).toBe('pommes');
  });

  it('writes results as equalities, with the remainder only when there is one', () => {
    expect(DICTIONARY.en.resultEquality('27', '3', '9', '0')).toBe('27 ÷ 3 = 9');
    expect(DICTIONARY.en.resultEquality('25', '4', '6', '1')).toBe('25 ÷ 4 = 6 r 1');
    expect(DICTIONARY.fr.resultEquality('25', '4', '6', '1')).toBe('25 ÷ 4 = 6, reste 1');
  });

  it('keeps symbols out of the symbol-free sentences', () => {
    for (const lang of ['en', 'fr'] as const) {
      const d = DICTIONARY[lang];
      const texts = [
        d.sharePrompt('12', 'dates', '3', true),
        d.shareLive({ plates: '3', each: '2', min: '', max: '', tray: '6', theme: 'dates', friends: true }),
        d.shareLive({ plates: '3', each: null, min: '1', max: '2', tray: '6', theme: 'dates', friends: true }),
        d.resultSentence('4', 'dates', true, '0'),
        d.resultSentence('4', 'dates', true, '1'),
        d.arrayReadout('8', '5', '40', true)
      ];
      for (const t of texts) expect(t).not.toMatch(/[÷×=→]/);
    }
  });

  it('puts a narrow no-break space before colons in French', () => {
    expect(DICTIONARY.fr.sharePrompt('12', 'dates', '3', true)).toContain(' :');
  });

  it('uses natural French for the take-back label, the row hint and the array left-over', () => {
    expect(DICTIONARY.fr.takeBackLabel('2', false)).toContain('Reprendre un élément');
    expect(DICTIONARY.fr.hintRoomForMore('8')).toBe('Il reste de la place pour une autre rangée de 8.');
    expect(DICTIONARY.fr.arrayLeftOver('7', '8', 'dates')).toContain('\u202f: moins que 8');
    expect(DICTIONARY.en.arrayLeftOver('1', '8', 'dates')).toContain('1 date left over');
  });

  it('describes mistakes in both languages', () => {
    expect(mistakesText('en', '0', 0)).toBe('no mistakes');
    expect(mistakesText('en', '1', 1)).toBe('1 mistake');
    expect(mistakesText('en', '4', 4)).toBe('4 mistakes');
    expect(mistakesText('fr', '0', 0)).toBe('aucune erreur');
    expect(mistakesText('fr', '1', 1)).toBe('1 erreur');
    expect(mistakesText('fr', '4', 4)).toBe('4 erreurs');
  });
});
