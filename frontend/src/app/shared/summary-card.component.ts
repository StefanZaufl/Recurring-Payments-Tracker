import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CurrencyFormatPipe } from './currency-format.pipe';

interface SummaryCardSubitem {
  label: string;
  value: number;
  action?: string;
}

type SummaryCardTone = 'income' | 'expense' | 'surplus';

@Component({
  selector: 'app-summary-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyFormatPipe],
  template: `
    <div class="glass-card p-4 sm:p-5 min-w-0 group transition-colors" [ngClass]="borderClass">
      <button type="button"
        class="block w-full text-left rounded-lg transition-colors"
        [class.cursor-pointer]="clickable"
        [class.hover:bg-card-hover]="clickable"
        [class.-m-2]="clickable"
        [class.p-2]="clickable"
        [disabled]="!clickable"
        (click)="onCardClicked()">
        <p class="stat-label mb-2">{{ label }}</p>
        <p class="stat-value" [ngClass]="valueClass">{{ value | appCurrency }}</p>
      </button>
      @if (subitems.length > 0) {
        <div class="mt-4 space-y-2 border-t border-card-border/80 pt-3">
          @for (subitem of subitems; track subitem.label) {
            <button type="button"
              class="flex w-full items-center justify-between gap-3 rounded-lg text-left text-xs transition-colors sm:text-sm"
              [class.cursor-pointer]="!!subitem.action"
              [class.hover:bg-card-hover]="!!subitem.action"
              [class.-mx-2]="!!subitem.action"
              [class.px-2]="!!subitem.action"
              [class.py-1]="!!subitem.action"
              [disabled]="!subitem.action"
              (click)="onSubitemClicked(subitem)">
              <span class="text-muted">{{ subitem.label }}</span>
              <span class="font-mono font-medium" [ngClass]="subitemValueClass">{{ subitem.value | appCurrency }}</span>
            </button>
          }
        </div>
      }
    </div>
  `
})
export class SummaryCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = 0;
  @Input() tone: SummaryCardTone = 'income';
  @Input() subitems: SummaryCardSubitem[] = [];
  @Input() positive = true;
  @Input() clickable = false;
  @Output() cardSelected = new EventEmitter<void>();
  @Output() subitemSelected = new EventEmitter<SummaryCardSubitem>();

  onCardClicked(): void {
    if (this.clickable) {
      this.cardSelected.emit();
    }
  }

  onSubitemClicked(subitem: SummaryCardSubitem): void {
    if (subitem.action) {
      this.subitemSelected.emit(subitem);
    }
  }

  get borderClass(): string {
    return this.tone === 'income'
      ? 'hover:border-accent/30'
      : this.tone === 'expense'
        ? 'hover:border-coral/30'
        : '';
  }

  get valueClass(): string {
    if (this.tone === 'income') {
      return 'text-accent';
    }
    if (this.tone === 'expense') {
      return 'text-coral';
    }
    return this.positive ? 'text-accent' : 'text-coral';
  }

  get subitemValueClass(): string {
    return this.tone === 'income' ? 'text-accent' : 'text-coral';
  }
}
