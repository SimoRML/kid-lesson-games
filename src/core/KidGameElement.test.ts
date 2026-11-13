import { describe, expect, it } from 'vitest';
import { KidGameElement } from './KidGameElement.js';
import { registry } from './registry.js';
import type { GameMetadata, KidGame } from './types.js';

describe('KidGameElement', () => {
  it('loads a registered game and honors attribute configuration', async () => {
    const uniqueId = `kid-game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const metadata: GameMetadata = {
      id: uniqueId,
      title: 'Element Test Game',
      version: '1.0.0',
      description: 'Validates mount lifecycle',
      category: 'spatial',
      ageGroups: ['3-5', '6-8'],
      skills: ['visual patterning']
    };

    const fakeGame: KidGame = {
      mount: async (container, context) => {
        container.innerHTML = '<div class="mounted">ready</div>';
        expect(context.ageGroup).toBe('9-11');
        expect(context.difficulty).toBe('hard');
        expect(context.sound).toBe(false);
        expect(context.locale).toBe('fr');
      },
      start: () => undefined,
      destroy: () => undefined
    };

    registry.register(metadata, async () => fakeGame);

    const element = new KidGameElement();
    element.setAttribute('game', uniqueId);
    element.setAttribute('age', '9-11');
    element.setAttribute('difficulty', 'hard');
    element.setAttribute('sound', 'false');
    element.setAttribute('locale', 'fr');
    element.setAttribute('autostart', 'false');

    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.gameId).toBe(uniqueId);
    expect(element.age).toBe('9-11');
    expect(element.difficulty).toBe('hard');
    expect(element.sound).toBe(false);
    expect(element.autostart).toBe(false);
    expect(element.locale).toBe('fr');
    expect(element.shadowRoot?.querySelector('.mounted')?.textContent).toBe('ready');

    document.body.removeChild(element);
  });
});
