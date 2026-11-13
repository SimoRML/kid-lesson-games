import { registry } from './registry.js';
import { SoundEngine } from './audio.js';
import { I18nManager } from './i18n.js';
import type { AgeGroup, Difficulty, GameContext, GameEventType, KidGame } from './types.js';

const STYLES = `
:host {
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: #0f172a;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  user-select: none;
}

.viewport {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

.status-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.95);
  color: #f8fafc;
  z-index: 50;
  gap: 16px;
  padding: 24px;
  text-align: center;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-title {
  color: #f87171;
  font-size: 1.25rem;
  font-weight: 700;
}

.game-slot {
  width: 100%;
  height: 100%;
  position: relative;
  flex: 1;
}
`;

export class KidGameElement extends HTMLElement {
  static get observedAttributes() {
    return ['game', 'age', 'difficulty', 'sound', 'autostart', 'locale', 'levels'];
  }

  private root: ShadowRoot;
  private container: HTMLDivElement;
  private statusScreen: HTMLDivElement;
  private currentGame: KidGame | null = null;
  private isMounted = false;
  private _customLevels: unknown = null;
  private currentLoadToken = 0;

  public readonly audio: SoundEngine;
  public readonly i18n: I18nManager;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = `
      <style>${STYLES}</style>
      <div class="viewport">
        <div class="status-screen" id="status" style="display: none;"></div>
        <div class="game-slot" id="slot"></div>
      </div>
    `;

    this.container = this.root.getElementById('slot') as HTMLDivElement;
    this.statusScreen = this.root.getElementById('status') as HTMLDivElement;

    this.audio = new SoundEngine(this.sound);
    this.i18n = new I18nManager(this.locale);
  }

  // Attributes getters
  get gameId(): string {
    return this.getAttribute('game') || '';
  }

  get age(): AgeGroup {
    const val = this.getAttribute('age');
    if (val === '3-5' || val === '6-8' || val === '9-11') return val;
    return '6-8';
  }

  get difficulty(): Difficulty {
    const val = this.getAttribute('difficulty');
    if (val === 'easy' || val === 'medium' || val === 'hard') return val;
    return 'medium';
  }

  get sound(): boolean {
    return this.getAttribute('sound') !== 'false';
  }

  get autostart(): boolean {
    return this.getAttribute('autostart') !== 'false';
  }

  get locale(): string {
    return this.getAttribute('locale') || 'en';
  }

  get levels(): unknown {
    if (this._customLevels !== null && this._customLevels !== undefined) {
      return this._customLevels;
    }
    const attr = this.getAttribute('levels');
    if (attr) {
      try {
        return JSON.parse(attr);
      } catch (e) {
        console.warn('Failed to parse levels JSON attribute:', e);
        return null;
      }
    }
    return null;
  }

  set levels(val: unknown) {
    this._customLevels = val;
    this.propagateConfigUpdate();
  }

  connectedCallback() {
    this.isMounted = true;
    this.audio.enabled = this.sound;
    this.i18n.locale = this.locale;
    if (this.gameId) {
      this.loadAndMountGame();
    }
  }

  disconnectedCallback() {
    this.isMounted = false;
    this.cleanupGame();
    this.audio.close();
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    if (oldVal === newVal || !this.isMounted) return;

    if (name === 'sound') {
      this.audio.enabled = this.sound;
    } else if (name === 'locale') {
      this.i18n.locale = this.locale;
    }

    if (name === 'game') {
      this.loadAndMountGame();
    } else {
      this.propagateConfigUpdate();
    }
  }

  private propagateConfigUpdate() {
    if (this.currentGame?.updateConfig) {
      this.currentGame.updateConfig({
        ageGroup: this.age,
        difficulty: this.difficulty,
        sound: this.sound,
        locale: this.locale,
        customLevels: this.levels,
        audio: this.audio,
        i18n: this.i18n,
        t: (key, params) => this.i18n.t(key, params)
      });
    }
  }

  // Public methods
  start() {
    this.currentGame?.start();
  }

  pause() {
    this.currentGame?.pause?.();
  }

  resume() {
    this.currentGame?.resume?.();
  }

  restart() {
    this.loadAndMountGame();
  }

  private showStatus(html: string) {
    this.statusScreen.innerHTML = html;
    this.statusScreen.style.display = 'flex';
  }

  private hideStatus() {
    this.statusScreen.style.display = 'none';
  }

  private cleanupGame() {
    if (this.currentGame) {
      try {
        this.currentGame.destroy();
      } catch (e) {
        console.error('Error during game teardown:', e);
      }
      this.currentGame = null;
    }
    this.container.innerHTML = '';
  }

  private async loadAndMountGame() {
    const id = this.gameId;
    if (!id) return;

    // Increment load token to invalidate any previous in-flight asynchronous operations
    const loadToken = ++this.currentLoadToken;

    this.cleanupGame();
    this.showStatus(`
      <div class="spinner"></div>
      <div>${this.i18n.t('loading')}</div>
    `);

    try {
      const { game } = await registry.create(id);

      // Race condition check: user changed game or unmounted while import was resolving
      if (this.currentLoadToken !== loadToken || !this.isMounted) {
        game.destroy?.();
        return;
      }

      this.currentGame = game;
      this.audio.enabled = this.sound;
      this.i18n.locale = this.locale;

      const context: GameContext = {
        ageGroup: this.age,
        difficulty: this.difficulty,
        sound: this.sound,
        locale: this.locale,
        customLevels: this.levels,
        audio: this.audio,
        i18n: this.i18n,
        t: (key, params) => this.i18n.t(key, params),
        emit: (type: GameEventType, payload: unknown) => {
          if (this.currentLoadToken !== loadToken || !this.isMounted) return;
          this.dispatchEvent(
            new CustomEvent(type, {
              detail: payload,
              bubbles: true,
              composed: true
            })
          );
        }
      };

      await game.mount(this.container, context);

      // Race condition check after mount completes
      if (this.currentLoadToken !== loadToken || !this.isMounted) {
        return;
      }

      this.hideStatus();

      this.dispatchEvent(
        new CustomEvent('game:ready', {
          detail: { gameId: id },
          bubbles: true,
          composed: true
        })
      );

      if (this.autostart) {
        game.start();
        this.dispatchEvent(
          new CustomEvent('game:start', {
            detail: { gameId: id },
            bubbles: true,
            composed: true
          })
        );
      }
    } catch (err: unknown) {
      if (this.currentLoadToken !== loadToken || !this.isMounted) return;

      const message = err instanceof Error ? err.message : String(err);
      this.showStatus(`
        <div class="error-title">${this.i18n.t('error')}</div>
        <div>${message}</div>
      `);
      this.dispatchEvent(
        new CustomEvent('game:error', {
          detail: { message },
          bubbles: true,
          composed: true
        })
      );
    }
  }
}
