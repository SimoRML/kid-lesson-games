/**
 * Core internationalization (i18n) manager for kid educational games.
 * Provides normalized locale resolution, parameter interpolation, and shared UI tokens.
 */

export interface CoreTranslations {
  [key: string]: string | undefined;
  soundOn: string;
  soundOff: string;
  level: string;
  score: string;
  reset: string;
  wellDone: string;
  loading: string;
  error: string;
}

export const CORE_DICTIONARY: Record<string, CoreTranslations> = {
  en: {
    soundOn: '🔊 Sound ON',
    soundOff: '🔇 Sound OFF',
    level: 'Level',
    score: 'Score',
    reset: 'Reset',
    wellDone: '✨ Well Done!',
    loading: 'Loading game...',
    error: 'Unable to Load Game'
  },
  fr: {
    soundOn: '🔊 Son ACTIF',
    soundOff: '🔇 Son COUPÉ',
    level: 'Niveau',
    score: 'Score',
    reset: 'Réinitialiser',
    wellDone: '✨ Bravo !',
    loading: 'Chargement du jeu...',
    error: 'Impossible de charger le jeu'
  }
};

export type TranslationDictionary<T = Record<string, unknown>> = Record<string, T>;

export class I18nManager {
  private _locale: string;
  private defaultLocale: string;

  constructor(initialLocale = 'en', defaultLocale = 'en') {
    this._locale = initialLocale;
    this.defaultLocale = defaultLocale;
  }

  get locale(): string {
    return this._locale;
  }

  set locale(val: string) {
    this._locale = val || this.defaultLocale;
  }

  /**
   * Normalizes a locale string (e.g., 'fr-FR' -> 'fr', 'en-US' -> 'en').
   */
  normalizeLocale(loc?: string): string {
    const raw = (loc || this._locale || this.defaultLocale).trim().toLowerCase();
    const primary = raw.split('-')[0].split('_')[0];
    return primary || this.defaultLocale;
  }

  /**
   * Resolves a translated string or function from a given dictionary.
   */
  resolve<T extends object>(dictionary: Record<string, T>, loc?: string): T {
    const lang = this.normalizeLocale(loc);
    if (dictionary[lang]) {
      return dictionary[lang];
    }
    if (dictionary[this.defaultLocale]) {
      return dictionary[this.defaultLocale];
    }
    const firstKey = Object.keys(dictionary)[0];
    return dictionary[firstKey] ?? ({} as T);
  }

  /**
   * Translates a core UI token or interpolated string.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const core = this.resolve(CORE_DICTIONARY, this._locale);
    let message = core[key];

    if (!message) {
      const fallback = this.resolve(CORE_DICTIONARY, this.defaultLocale);
      message = fallback[key] || key;
    }

    if (params) {
      return interpolate(message, params);
    }
    return message;
  }
}

/**
 * Replaces `{name}` placeholders in text with parameter values.
 */
export function interpolate(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return paramKey in params ? String(params[paramKey]) : match;
  });
}

/**
 * Helper to create an i18n resolver for game cartridges with their own typed dictionaries.
 */
export function createI18nResolver<T extends object>(
  dictionary: Record<string, T>,
  defaultLocale = 'en'
) {
  return (currentLocale?: string): T => {
    const lang = (currentLocale || defaultLocale).trim().toLowerCase().split('-')[0].split('_')[0];
    if (dictionary[lang]) return dictionary[lang];
    if (dictionary[defaultLocale]) return dictionary[defaultLocale];
    const first = Object.keys(dictionary)[0];
    return dictionary[first] ?? ({} as T);
  };
}
