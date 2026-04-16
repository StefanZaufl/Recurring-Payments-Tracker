import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CurrencyFormatPipe } from './currency-format.pipe';

interface SummaryCardSubitem {
  label: string;
  value: number;
}

type SummaryCardTone = 'income' | 'expense' | 'surplus';

@Component({
  selector: 'app-summary-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyFormatPipe],
  template: `
    <div class="glass-card p-4 sm:p-5 min-w-0 group transition-colors" [ngClass]="borderClass">
      <p class="stat-label mb-2">{{ label }}</p>
      <p class="stat-value" [ngClass]="valueClass">{{ value | appCurrency }}</p>
      @if (subitems.length > 0) {
        <div class="mt-4 space-y-2 border-t border-card-border/80 pt-3">
          @for (subitem of subitems; track subitem.label) {
            <div class="flex items-center justify-between gap-3 text-xs sm:text-sm">
              <span class="text-muted">{{ subitem.label }}</span>
              <span class="font-mono font-medium" [ngClass]="subitemValueClass">{{ subitem.value | appCurrency }}</span>
            </div>
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
