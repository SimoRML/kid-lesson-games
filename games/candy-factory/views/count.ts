/**
 * Count view (ages 3-5): a customer asks for N candies; the child drops them
 * into the bag one by one (tap or drag from the jar). Ten loose candies are
 * packed into a bag automatically, so 13 reads as "1 bag + 3".
 */

import type { CountLevel } from '../levels.js';
import { button, customerCard, el, hits, item, swapContent, tapOrDrag } from './dom.js';
import type { View, ViewHost } from './types.js';

/** Dot pattern used to show a quantity to pre-readers (dice-like for 1-9). */
export function dots(n: number, className = 'cf-dot'): HTMLElement {
  const box = el('span', 'cf-dots');
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) box.appendChild(el('span', className));
  return box;
}

export class CountView implements View {
  private count = 0;
  private bagFlash = false;

  constructor(
    private readonly stage: HTMLElement,
    private readonly level: CountLevel,
    private readonly host: ViewHost,
    private readonly avatar: number
  ) {
    this.render();
  }

  get current(): number {
    return this.count;
  }

  render(): void {
    const t = this.host.t();
    const fmt = (n: number): string => this.host.fmt(n);
    const signal = this.host.signal;
    const enabled = (): boolean => this.host.isActive();
    this.host.setInstruction(t.countPrompt(this.host.customer, fmt(this.level.target)));

    const root = el('div', 'cf-count');
    const bubble = el('div', 'cf-order');
    bubble.append(el('span', 'cf-order-num', fmt(this.level.target)));
    if (this.level.target <= 10) bubble.append(dots(this.level.target, 'cf-dot cf-dot-ghost'));
    root.appendChild(customerCard(this.host.customer, this.avatar, bubble));

    const row = el('div', 'cf-count-row');
    const jar = button('cf-jar', '', t.addCandy);
    jar.append(el('span', 'cf-jar-lid'), item(0, 'cf-jar-candy'), item(0, 'cf-jar-candy'), item(0, 'cf-jar-candy'));
    const bag = el('div', 'cf-bag-area');
    bag.setAttribute('aria-label', t.countLive(fmt(this.count)));

    const bags = Math.floor(this.count / 10);
    const loose = this.count % 10;
    for (let i = 0; i < bags; i++) {
      const b = button('cf-piece', '', t.unit(1, 1));
      b.appendChild(item(1, this.bagFlash && i === bags - 1 ? 'cf-squish' : ''));
      // A bag can be opened only when no loose candy is left (keeps "one less" simple).
      b.disabled = loose > 0;
      b.addEventListener('click', () => enabled() && this.remove(), { signal });
      bag.appendChild(b);
    }
    for (let i = 0; i < loose; i++) {
      const c = button('cf-piece', '', t.unit(0, 1));
      c.appendChild(item(0, i === loose - 1 && !this.bagFlash ? 'cf-pop' : ''));
      c.addEventListener('click', () => enabled() && this.remove(), { signal });
      bag.appendChild(c);
    }
    this.bagFlash = false;

    tapOrDrag(jar, {
      signal,
      enabled,
      onTap: () => this.add(),
      ghost: () => item(0),
      onDrop: (p) => {
        if (hits(bag, p)) this.add();
      }
    });

    const counter = el('div', 'cf-counter', fmt(this.count));
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-label', t.countLive(fmt(this.count)));
    row.append(jar, bag);

    const ship = button('cf-btn cf-btn-primary cf-ship', t.ship);
    ship.addEventListener('click', () => enabled() && this.ship(), { signal });

    jar.dataset.key = 'jar';
    ship.dataset.key = 'ship';
    root.append(row, counter, ship);
    swapContent(this.stage, root);
  }

  private add(): void {
    if (this.count >= 19) {
      this.host.audio.playError();
      this.host.setInstruction(this.host.t().tooMany);
      return;
    }
    this.count++;
    // A rising tone per candy: the count can be heard.
    this.host.audio.playTone(330 + (this.count % 10) * 45, 0.12, 'sine', { gain: 0.12 });
    if (this.count % 10 === 0) {
      this.bagFlash = true;
      this.host.audio.playPop();
    }
    this.render();
    if (this.count % 10 === 0) this.host.setInstruction(this.host.t().bagMade);
  }

  private remove(): void {
    if (this.count === 0) return;
    this.count--;
    this.host.audio.playClick();
    this.render();
  }

  private ship(): void {
    const t = this.host.t();
    if (this.count === this.level.target) {
      this.host.audio.playDrop();
      this.host.solved();
      return;
    }
    this.host.audio.playError();
    this.host.mistake();
    this.host.setInstruction(this.count < this.level.target ? t.tooFew : t.tooMany);
  }
}
