import { describe, expect, it } from 'vitest';
import { KidGameElement, registry } from './index.js';

describe('Root Package Entry Point (src/index.ts)', () => {
  it('discovers and registers built-in games', () => {
    const list = registry.list();
    expect(list.length).toBeGreaterThanOrEqual(1);

    const balanceScale = registry.get('balance-scale');
    expect(balanceScale).toBeDefined();
    expect(balanceScale?.metadata.id).toBe('balance-scale');
    expect(balanceScale?.metadata.author).toBe('simorml');
    expect(balanceScale?.metadata.thumbnail).toBe('assets/thumb.svg');
  });

  it('defines the <kid-game> custom element in the DOM registry', () => {
    expect(customElements.get('kid-game')).toBe(KidGameElement);
  });
});
