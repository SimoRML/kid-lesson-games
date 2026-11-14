import { describe, expect, it } from 'vitest';
import { KidGameElement } from './KidGameElement.js';
import { registry } from './registry.js';
import type { GameMetadata, KidGame } from './types.js';

if (!customElements.get('kid-game')) {
  customElements.define('kid-game', KidGameElement);
}

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

  it('updates configuration dynamically when attributes or properties change', async () => {
    const uniqueId = `dynamic-test-${Date.now()}`;
    const metadata: GameMetadata = {
      id: uniqueId,
      title: 'Dynamic Test',
      version: '1.0.0',
      description: 'Tests config update',
      category: 'logic',
      ageGroups: ['6-8'],
      skills: ['logic']
    };

    let updatedContext: any = null;
    let paused = false;
    let resumed = false;
    let destroyed = false;

    const fakeGame: KidGame = {
      mount: async () => undefined,
      start: () => undefined,
      pause: () => { paused = true; },
      resume: () => { resumed = true; },
      updateConfig: (ctx) => { updatedContext = ctx; },
      destroy: () => { destroyed = true; }
    };

    registry.register(metadata, async () => fakeGame);

    const element = document.createElement('kid-game') as KidGameElement;
    element.setAttribute('game', uniqueId);
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Test levels property setter and getter
    const customLevels = [{ left: [500], inventory: [250, 250] }];
    element.levels = customLevels;
    expect(element.levels).toEqual(customLevels);
    expect(updatedContext?.customLevels).toEqual(customLevels);

    // Test attribute change
    element.setAttribute('age', '9-11');
    element.setAttribute('sound', 'false');
    expect(updatedContext?.ageGroup).toBe('9-11');
    expect(updatedContext?.sound).toBe(false);

    // Test pause and resume
    element.pause();
    expect(paused).toBe(true);
    element.resume();
    expect(resumed).toBe(true);

    // Test restart
    element.restart();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Test disconnect teardown
    document.body.removeChild(element);
    expect(destroyed).toBe(true);
  });

  it('displays error screen when loading an unknown game', async () => {
    const element = document.createElement('kid-game') as KidGameElement;
    element.setAttribute('game', 'non-existent-game-id');
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const statusScreen = element.shadowRoot?.querySelector('#status') as HTMLElement;
    expect(statusScreen?.style.display).not.toBe('none');
    expect(statusScreen?.textContent).toContain('not found in registry');

    document.body.removeChild(element);
  });

  it('renders an error message containing markup as plain text', async () => {
    const payload = '<img src=x onerror="window.__kidGameInjected = true">';
    const element = document.createElement('kid-game') as KidGameElement;
    element.setAttribute('game', payload);

    let errorMessage = '';
    element.addEventListener('game:error', (event) => {
      errorMessage = (event as CustomEvent<{ message: string }>).detail.message;
    });

    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const statusScreen = element.shadowRoot?.querySelector('#status') as HTMLElement;
    expect(statusScreen.style.display).toBe('flex');
    expect(element.shadowRoot?.querySelector('img')).toBeNull();
    expect(statusScreen.querySelector('.error-title')?.textContent).toBe(element.i18n.t('error'));
    expect(statusScreen.textContent).toContain(payload);
    expect(errorMessage).toContain(payload);

    document.body.removeChild(element);
  });

  it('renders the loading screen as a spinner plus text', async () => {
    const uniqueId = `kid-game-loading-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let finishMount: () => void = () => undefined;
    const fakeGame: KidGame = {
      mount: () => new Promise<void>((resolve) => { finishMount = resolve; }),
      start: () => undefined,
      destroy: () => undefined
    };
    registry.register(
      {
        id: uniqueId,
        title: 'Loading Test Game',
        version: '1.0.0',
        description: 'Validates loading screen',
        category: 'logic',
        ageGroups: ['6-8'],
        skills: ['patience']
      },
      async () => fakeGame
    );

    const element = document.createElement('kid-game') as KidGameElement;
    element.setAttribute('game', uniqueId);
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const statusScreen = element.shadowRoot?.querySelector('#status') as HTMLElement;
    expect(statusScreen.style.display).toBe('flex');
    expect(statusScreen.children).toHaveLength(2);
    expect(statusScreen.children[0].className).toBe('spinner');
    expect(statusScreen.children[1].textContent).toBe(element.i18n.t('loading'));

    finishMount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(statusScreen.style.display).toBe('none');

    document.body.removeChild(element);
  });

  it('injects audio and i18n into GameContext and propagates sound and locale dynamically', async () => {
    const uniqueId = `audio-i18n-test-${Date.now()}`;
    const metadata: GameMetadata = {
      id: uniqueId,
      title: 'Context Audio Test',
      version: '1.0.0',
      description: 'Tests audio and i18n context injection',
      category: 'numbers',
      ageGroups: ['6-8'],
      skills: ['math']
    };

    let receivedContext: any = null;
    let updatedConfig: any = null;

    const fakeGame: KidGame = {
      mount: async (_container, context) => {
        receivedContext = context;
      },
      updateConfig: (ctx) => {
        updatedConfig = ctx;
      },
      start: () => undefined,
      destroy: () => undefined
    };

    registry.register(metadata, async () => fakeGame);

    const element = document.createElement('kid-game') as KidGameElement;
    element.setAttribute('game', uniqueId);
    element.setAttribute('sound', 'true');
    element.setAttribute('locale', 'en');
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 15));

    expect(receivedContext).toBeDefined();
    expect(receivedContext.audio).toBeDefined();
    expect(receivedContext.audio.enabled).toBe(true);
    expect(receivedContext.i18n).toBeDefined();
    expect(receivedContext.t('soundOn')).toBe('🔊 Sound ON');

    // Dynamically toggle sound off and change locale to fr
    element.setAttribute('sound', 'false');
    expect(element.audio.enabled).toBe(false);
    expect(updatedConfig?.sound).toBe(false);

    element.setAttribute('locale', 'fr');
    expect(element.i18n.locale).toBe('fr');
    expect(updatedConfig?.locale).toBe('fr');
    expect(updatedConfig?.t('soundOn')).toBe('🔊 Son ACTIF');

    document.body.removeChild(element);
  });

  it('prevents race conditions when game attribute changes rapidly', async () => {
    const slowGameId = `slow-game-${Date.now()}`;
    const fastGameId = `fast-game-${Date.now()}`;

    let slowDestroyed = false;
    let slowMounted = false;
    let fastMounted = false;

    registry.register(
      {
        id: slowGameId,
        title: 'Slow Game',
        version: '1.0.0',
        description: 'Simulates slow lazy loading',
        category: 'logic',
        ageGroups: ['6-8'],
        skills: []
      },
      async () => {
        // Introduce artificial network latency
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          mount: async () => {
            slowMounted = true;
          },
          start: () => undefined,
          destroy: () => {
            slowDestroyed = true;
          }
        };
      }
    );

    registry.register(
      {
        id: fastGameId,
        title: 'Fast Game',
        version: '1.0.0',
        description: 'Fast game load',
        category: 'logic',
        ageGroups: ['6-8'],
        skills: []
      },
      async () => {
        return {
          mount: async () => {
            fastMounted = true;
          },
          start: () => undefined,
          destroy: () => undefined
        };
      }
    );

    const element = document.createElement('kid-game') as KidGameElement;
    document.body.appendChild(element);

    // Rapid switch: slow game requested first, fast game immediately after
    element.setAttribute('game', slowGameId);
    element.setAttribute('game', fastGameId);

    // Wait for all async loads to finish
    await new Promise((resolve) => setTimeout(resolve, 80));

    // The fast game should have mounted successfully, while slow game was aborted/destroyed
    expect(fastMounted).toBe(true);
    expect(slowMounted).toBe(false);
    expect(slowDestroyed).toBe(true);

    document.body.removeChild(element);
  });
});
