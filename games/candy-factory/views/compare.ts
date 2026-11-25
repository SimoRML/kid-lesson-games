/**
 * Compare view: two customers' jars; give the one with more (or fewer) candies.
 * Jars show bags of ten plus loose candies, so at 6-8 the jar with more loose
 * candies can hold fewer in total: the child must read the bags first.
 */

import { toDigits } from '../numbers.js';
import type { CompareLevel } from '../levels.js';
import { CUSTOMERS } from '../i18n.js';
import { button, el, item, swapContent } from './dom.js';
import type { View, ViewHost } from './types.js';

export class CompareView implements View {
  private wrongPick: number | null = null;
  private names: [string, string];

  constructor(
    private readonly stage: HTMLElement,
    private readonly level: CompareLevel,
    private readonly host: ViewHost
  ) {
    const i = CUSTOMERS.indexOf(host.customer as (typeof CUSTOMERS)[number]);
    const other = CUSTOMERS[(Math.max(0, i) + 3) % CUSTOMERS.length];
    this.names = [host.customer, other];
    this.render();
  }

  /** Index of the jar that answers the question. */
  get answer(): 0 | 1 {
    const [a, b] = this.level.values;
    const firstBigger = a > b;
    return (this.level.ask === 'more') === firstBigger ? 0 : 1;
  }

  /** Numerals are hidden only for the youngest on easy (pure quantity comparison). */
  private get showNumerals(): boolean {
    return !(this.host.ageGroup === '3-5' && this.host.difficulty === 'easy');
  }

  render(): void {
    const t = this.host.t();
    this.host.setInstruction(t.comparePrompt(this.level.ask));
    const root = el('div', 'cf-compare');
    const signal = this.host.signal;

    this.level.values.forEach((value, index) => {
      const name = this.names[index];
      // Screen readers always hear the quantity (the pictures are aria-hidden).
      const jar = button(
        `cf-jar-big${this.wrongPick === index ? ' cf-shake' : ''}`,
        '',
        `${t.jarOf(name)}: ${this.host.fmt(value)}`
      );
      jar.dataset.key = `jar-${index}`;

      const contents = el('span', 'cf-jar-contents');
      const digits = toDigits(value, 1);
      for (let c = digits.length - 1; c >= 0; c--) {
        for (let k = 0; k < digits[c]; k++) contents.appendChild(item(Math.min(c, 3)));
      }
      jar.append(el('span', 'cf-jar-lid'), contents);
      if (this.showNumerals) jar.append(el('span', 'cf-jar-num', this.host.fmt(value)));
      jar.append(el('span', 'cf-name', name));

      jar.addEventListener(
        'click',
        () => {
          if (!this.host.isActive()) return;
          if (index === this.answer) {
            this.host.audio.playChime();
            this.host.solved();
            return;
          }
          this.host.audio.playError();
          this.host.mistake();
          this.wrongPick = index;
          this.render();
          const big = Math.max(...this.level.values) >= 10;
          this.host.setInstruction(big ? t.compareHintTens : t.compareHintSmall);
        },
        { signal }
      );
      root.appendChild(jar);
    });
    this.wrongPick = null;
    swapContent(this.stage, root);
  }
}
