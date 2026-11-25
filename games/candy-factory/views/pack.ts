/**
 * Pack view (physical addition, ages 6-8 and the first orders at 9-11).
 *
 * All orders are poured onto the belt at once: each place-value bin holds the
 * raw column sum (e.g. 27 + 15 gives 3 bags and 12 candies). Moving 10 items of
 * a bin into its machine produces 1 item of the next bin: that is the carry.
 * The truck refuses a shipment that is not packed compactly, then the child
 * writes the label (the total).
 */

import type { AddLevel } from '../levels.js';
import { columnSums, digitCount, isCompact, PACK_SIZE, valueOf } from '../numbers.js';
import { describeCounts } from '../i18n.js';
import { bindKeyboard, button, el, hits, item, keypad, swapContent, tapOrDrag } from './dom.js';
import type { View, ViewHost } from './types.js';

const MAX_LABEL_DIGITS = 5;

export class PackView implements View {
  readonly columns: number;
  /** Items in each bin (column 0 = candies). */
  counts: number[];
  /** Items waiting in each machine's funnel (always < 10). */
  funnel: number[];
  phase: 'packing' | 'label' = 'packing';
  label = '';
  private justPacked = -1;
  private keyboardBound = false;

  constructor(
    private readonly stage: HTMLElement,
    private readonly level: AddLevel,
    private readonly host: ViewHost
  ) {
    const sum = level.terms.reduce((a, b) => a + b, 0);
    this.columns = digitCount(sum);
    this.counts = columnSums(level.terms, this.columns);
    this.funnel = new Array<number>(this.columns).fill(0);
    this.render();
  }

  get sum(): number {
    return this.level.terms.reduce((a, b) => a + b, 0);
  }

  /** Ages 9-11 may pack 10 at once by tapping the machine; younger children count them in. */
  private get fastPack(): boolean {
    return this.host.ageGroup === '9-11';
  }

  private liveText(): string {
    const t = this.host.t();
    const shown = this.counts.map((c, i) => c + this.funnel[i]);
    return t.packLive(describeCounts(t, shown, (n) => this.host.fmt(n)));
  }

  render(): void {
    const t = this.host.t();
    const signal = this.host.signal;
    const enabled = (): boolean => this.host.isActive();
    const fmt = (n: number): string => this.host.fmt(n);

    if (this.phase === 'packing') {
      const orders = this.level.terms.map(fmt).join(' + ');
      this.host.setInstruction(`${t.packPrompt(this.host.customer, orders)} ${this.liveText()}`);
    } else {
      this.host.setInstruction(t.labelPrompt);
    }

    const root = el('div', 'cf-pack');

    // Order tickets.
    const tickets = el('div', 'cf-tickets');
    this.level.terms.forEach((term, i) => {
      const ticket = el('div', 'cf-ticket');
      if (this.level.story === 'bill') ticket.append(el('span', 'cf-ticket-label', t.items[i % t.items.length]));
      ticket.append(el('span', 'cf-ticket-num', fmt(term)));
      if (this.level.story === 'bill') ticket.append(el('span', 'cf-ticket-label', t.currency));
      tickets.appendChild(ticket);
    });
    root.appendChild(tickets);

    // The belt: highest place value on the left, like a written number.
    const belt = el('div', `cf-belt cf-cols-${this.columns}`);
    const machines: HTMLElement[] = [];
    for (let c = this.columns - 1; c >= 0; c--) {
      const col = el('div', `cf-col cf-place-${c}`);
      const hasMachine = c < this.columns - 1;

      const machineSlot = el('div', 'cf-machine-slot');
      if (hasMachine) {
        const machine = button(
          `cf-machine${this.funnel[c] > 0 ? ' cf-machine-busy' : ''}`,
          '',
          `${t.machine(c)} ${t.funnel(fmt(this.funnel[c]))}`
        );
        machine.dataset.key = `machine-${c}`;
        machine.dataset.column = String(c);
        machine.append(el('span', 'cf-machine-arrow', '←'), el('span', 'cf-funnel', t.funnel(fmt(this.funnel[c]))));
        const fill = el('span', 'cf-funnel-bar');
        fill.style.width = `${(this.funnel[c] / PACK_SIZE) * 100}%`;
        machine.appendChild(fill);
        machine.disabled = this.phase !== 'packing';
        machine.addEventListener('click', () => enabled() && this.tapMachine(c), { signal });
        machines[c] = machine;
        machineSlot.appendChild(machine);
      }
      col.appendChild(machineSlot);

      const bin = button(
        `cf-bin${this.justPacked === c ? ' cf-bin-new' : ''}`,
        '',
        `${fmt(this.counts[c])} ${t.unit(c, this.counts[c])}`
      );
      bin.dataset.key = `bin-${c}`;
      bin.dataset.column = String(c);
      const pile = el('span', 'cf-pile');
      for (let k = 0; k < this.counts[c]; k++) {
        pile.appendChild(item(c, this.justPacked === c && k === this.counts[c] - 1 ? 'cf-squish' : ''));
      }
      bin.append(pile, el('span', 'cf-bin-count', fmt(this.counts[c])));
      bin.disabled = this.phase !== 'packing' || !hasMachine;
      col.append(bin, el('span', 'cf-col-name', t.unit(c, 2)));
      belt.appendChild(col);

      if (hasMachine) {
        tapOrDrag(bin, {
          signal,
          enabled: () => enabled() && this.phase === 'packing',
          onTap: () => this.feed(c),
          ghost: () => item(c),
          onDrop: (p) => {
            const target = machines[c];
            if (target && hits(target, p)) this.feed(c);
          }
        });
      }
    }
    root.appendChild(belt);

    if (this.phase === 'packing') {
      const ship = button('cf-btn cf-btn-primary cf-ship', t.ship);
      ship.dataset.key = 'ship';
      ship.addEventListener('click', () => enabled() && this.ship(), { signal });
      root.appendChild(ship);
    } else {
      const labelBox = el('div', 'cf-label');
      labelBox.append(el('span', 'cf-label-tag', '🏷️'), el('span', 'cf-label-value', this.label || '…'));
      labelBox.setAttribute('aria-live', 'polite');
      const opts = {
        signal,
        enabled: () => enabled() && this.phase === 'label',
        onDigit: (d: number) => this.typeDigit(d),
        eraseLabel: t.erase,
        onErase: () => this.erase(),
        checkLabel: t.check,
        onCheck: () => this.checkLabel()
      };
      if (!this.keyboardBound) {
        bindKeyboard(this.stage, opts);
        this.keyboardBound = true;
      }
      root.append(labelBox, keypad(opts));
    }

    this.justPacked = -1;
    swapContent(this.stage, root);
  }

  /** Moves one item of `column` into its machine. */
  feed(column: number): void {
    if (this.phase !== 'packing' || column >= this.columns - 1) return;
    if (this.counts[column] === 0) {
      this.host.audio.playError();
      return;
    }
    this.counts[column]--;
    this.funnel[column]++;
    this.host.audio.playTone(420 + this.funnel[column] * 40, 0.08, 'triangle', { gain: 0.1 });
    if (this.funnel[column] === PACK_SIZE) this.runMachine(column);
    else this.render();
  }

  /** Tapping a machine: 9-11 packs 10 at once; otherwise it gives the funnel back (undo). */
  tapMachine(column: number): void {
    if (this.phase !== 'packing') return;
    const t = this.host.t();
    if (this.fastPack && this.counts[column] + this.funnel[column] >= PACK_SIZE) {
      this.counts[column] -= PACK_SIZE - this.funnel[column];
      this.funnel[column] = PACK_SIZE;
      this.runMachine(column);
      return;
    }
    if (this.funnel[column] > 0) {
      this.counts[column] += this.funnel[column];
      this.funnel[column] = 0;
      this.host.audio.playClick();
      this.render();
      return;
    }
    this.host.audio.playError();
    this.host.setInstruction(t.needTen(t.unit(column, 2)));
  }

  private runMachine(column: number): void {
    this.funnel[column] = 0;
    this.counts[column + 1]++;
    this.justPacked = column + 1;
    this.host.audio.playPop();
    this.render();
  }

  ship(): void {
    if (this.phase !== 'packing') return;
    const t = this.host.t();
    const tooMany = this.counts.findIndex((c, i) => c + this.funnel[i] >= PACK_SIZE);
    if (tooMany >= 0 || !isCompact(this.counts)) {
      const column = Math.max(0, tooMany);
      this.host.audio.playError();
      this.host.setInstruction(t.truckRefuses(t.unit(column, 2), t.machine(column)));
      return;
    }
    const halfFull = this.funnel.findIndex((f) => f > 0);
    if (halfFull >= 0) {
      // A half-filled machine cannot run: tap it to take the items back.
      this.host.audio.playError();
      this.host.setInstruction(t.needTen(t.unit(halfFull, 2)));
      return;
    }
    this.host.audio.playChime();
    this.phase = 'label';
    this.render();
  }

  typeDigit(d: number): void {
    if (this.phase !== 'label' || this.label.length >= MAX_LABEL_DIGITS) return;
    if (this.label === '' && d === 0) return;
    this.label += String(d);
    this.host.audio.playClick();
    this.render();
  }

  erase(): void {
    if (this.phase !== 'label' || this.label === '') return;
    this.label = this.label.slice(0, -1);
    this.render();
  }

  checkLabel(): void {
    if (this.phase !== 'label' || this.label === '') return;
    if (Number(this.label) === valueOf(this.counts) && valueOf(this.counts) === this.sum) {
      this.host.audio.playDrop();
      this.host.solved();
      return;
    }
    this.host.audio.playError();
    this.host.mistake();
    this.label = '';
    this.render();
    this.host.setInstruction(this.host.t().labelWrong);
  }
}
