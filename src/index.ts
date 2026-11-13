import { registry } from './core/registry.js';
import { KidGameElement } from './core/KidGameElement.js';
import type { GameMetadata, KidGame } from './core/types.js';

// Auto-discover game metadata eagerly across games/*/ (supports both game.json and meta.json)
const metaModules = import.meta.glob<Record<string, unknown>>(
  ['../games/*/game.json', '../games/*/meta.json'],
  { eager: true }
);

// Dynamic lazy factory imports for game code (code-split per cartridge)
const gameFactories = import.meta.glob<Record<string, unknown>>('../games/*/index.ts');

for (const [path, metaMod] of Object.entries(metaModules)) {
  const raw = ('default' in metaMod ? metaMod.default : metaMod) as Record<string, unknown>;
  const parts = path.split('/');
  const fallbackId = parts[2];

  const meta: GameMetadata = {
    id: (raw.id as string) || fallbackId,
    title: (raw.title as string) || 'Untitled Game',
    version: (raw.version as string) || '1.0.0',
    description: (raw.description as string) || '',
    category: (raw.category as GameMetadata['category']) || 'numbers',
    ageGroups: (raw.ageGroups as GameMetadata['ageGroups']) || ['6-8'],
    skills: (raw.skills as string[]) || []
  };

  const gameDir = path.replace(/\/(game|meta)\.json$/, '');
  const indexPath = `${gameDir}/index.ts`;

  if (gameFactories[indexPath]) {
    registry.register(meta, async () => {
      const mod = (await gameFactories[indexPath]()) as {
        createGame?: () => KidGame;
        default?: () => KidGame;
        createBalanceScaleGame?: () => KidGame;
      };
      const factory = mod.createGame || mod.default || mod.createBalanceScaleGame;
      if (!factory) {
        throw new Error(
          `Game module at ${indexPath} must export createGame() or a default factory function.`
        );
      }
      return factory();
    });
  }
}

// Register the custom element AFTER registry is populated
if (typeof window !== 'undefined' && !customElements.get('kid-game')) {
  customElements.define('kid-game', KidGameElement);
}

export * from './core/types.js';
export { registry, GameRegistry } from './core/registry.js';
export { KidGameElement } from './core/KidGameElement.js';
export { SoundEngine } from './core/audio.js';
export {
  I18nManager,
  CORE_DICTIONARY,
  createI18nResolver,
  interpolate,
  type CoreTranslations,
  type TranslationDictionary
} from './core/i18n.js';
