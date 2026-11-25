/**
 * Estimate view (ages 9-11): before packing, choose the truck closest to the
 * order's size, rounded to the nearest thousand. Estimation has a purpose:
 * a truck too small or too big wastes a trip.
 */

import { estimateOptions, type EstimateLevel } from '../levels.js';
import { button, el, swapContent } from './dom.js';
import type { View, ViewHost } from './types.js';

export class EstimateView implements View {
  readonly answer: number;
  readonly options: number[];
  private chosen: number | null = null;
  private wrong: number | null = null;

  constructor(
    private readonly stage: HTMLElement,
    private readonly level: EstimateLevel,
    private readonly host: ViewHost
  ) {
    const { answer, options } = estimateOptions(level.terms);
    this.answer = answer;
    this.options = options;
    this.render();
  }

  get sum(): number {
    return this.level.terms.reduce((a, b) => a + b, 0);
  }

  render(): void {
    const t = this.host.t();
    const fmt = (n: number): string => this.host.fmt(n);
    this.host.setInstruction(this.chosen === null ? t.estimatePrompt : t.exactly(fmt(this.sum)));
    const root = el('div', 'cf-estimate');

    const orders = el('div', 'cf-tickets');
    this.level.terms.forEach((term, i) => {
      if (i > 0) orders.appendChild(el('span', 'cf-plus', '+'));
      const ticket = el('div', 'cf-ticket');
      ticket.appendChild(el('span', 'cf-ticket-num', fmt(term)));
      orders.appendChild(ticket);
    });
    root.appendChild(orders);

    const trucks = el('div', 'cf-trucks');
    this.options.forEach((value, i) => {
      const truck = button(
        `cf-truck cf-truck-${i}${this.chosen === value ? ' cf-truck-go' : ''}${this.wrong === value ? ' cf-shake' : ''}`,
        '',
        t.truck(fmt(value))
      );
      truck.dataset.key = `truck-${i}`;
      truck.append(el('span', 'cf-truck-icon', '🚚'), el('span', 'cf-truck-label', t.truck(fmt(value))));
      truck.disabled = this.chosen !== null;
      truck.addEventListener('click', () => this.host.isActive() && this.choose(value), { signal: this.host.signal });
      trucks.appendChild(truck);
    });
    root.appendChild(trucks);
    this.wrong = null;
    swapContent(this.stage, root);
  }

  choose(value: number): void {
    if (this.chosen !== null) return;
    if (value === this.answer) {
      this.chosen = value;
      this.host.audio.playChime();
      this.render();
      this.host.solved();
      return;
    }
    this.host.audio.playError();
    this.host.mistake();
    this.wrong = value;
    this.render();
    this.host.setInstruction(this.host.t().estimateWrong);
  }
}
