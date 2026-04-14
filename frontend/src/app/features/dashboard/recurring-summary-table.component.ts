import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { RecurringPaymentSummary } from '../../api/generated/model/recurringPaymentSummary';

type SortColumn = 'name' | 'category' | 'monthlyAmount' | 'annualAmount';
type SortDirection = 'asc' | 'desc';
type TableTone = 'income' | 'expense';

export interface RecurringSummaryHistoryState {
  paymentId: string | null;
  loading: boolean;
  data: ChartConfiguration<'line'>['data'];
}

@Component({
  selector: 'app-sort-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="w-3 h-3 text-muted/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      @if (direction === 'asc') {
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 15l4-4 4 4" />
      } @else {
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4 4 4-4" />
      }
    </svg>
  `
})
export class SortIconComponent {
  @Input() direction: SortDirection = 'desc';
}

@Component({
  selector: 'app-recurring-summary-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BaseChartDirective, CurrencyFormatPipe, SortIconComponent],
  template: `
    <div class="glass-card overflow-hidden">
      <div class="px-4 sm:px-5 py-4 border-b border-card-border flex items-center justify-between">
        <h2 class="text-sm font-semibold text-white">{{ title }}</h2>
        <span class="text-xs text-muted font-mono">{{ items.length }} items</span>
      </div>
      @if (items.length === 0) {
        <div class="p-6 text-center">
          <p class="text-sm text-muted">{{ emptyMessage }}</p>
        </div>
      }
      @if (items.length > 0) {
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="border-b border-card-border">
                @for (column of columns; track column.key) {
                  <th class="table-header p-0" [class.text-right]="column.align === 'right'">
                    <button
                      type="button"
                      class="group flex w-full items-center gap-2 px-4 py-3 uppercase tracking-wider"
                      [class.justify-end]="column.align === 'right'"
                      [attr.aria-label]="'Sort by ' + column.label"
                      (click)="sortBy(column.key)">
                      <span>{{ column.label }}</span>
                      <span
                        class="hidden sm:inline-flex transition-opacity"
                        [class.opacity-0]="activeSort.column !== column.key"
                        [class.group-hover:opacity-100]="activeSort.column !== column.key">
                        @if (activeSort.column === column.key) {
                          <app-sort-icon [direction]="activeSort.direction" />
                        } @else {
                          <app-sort-icon direction="desc" />
                        }
                      </span>
                      <span class="sm:hidden inline-flex">
                        @if (activeSort.column === column.key) {
                          <app-sort-icon [direction]="activeSort.direction" />
                        }
                      </span>
                    </button>
                  </th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-card-border">
              @for (payment of sortedItems; track payment.id) {
                <tr (click)="togglePaymentHistory(payment.id)"
                  class="cursor-pointer transition-colors duration-150 select-none"
                  [class.bg-card-hover]="expandedPaymentId === payment.id"
                  [class.hover:bg-card-hover]="expandedPaymentId !== payment.id">
                  <td class="table-cell font-medium text-white">
                    <div class="flex items-center gap-2.5">
                      <svg class="w-3.5 h-3.5 text-muted/60 transition-transform duration-200 shrink-0"
                        [style.transform]="expandedPaymentId === payment.id ? 'rotate(90deg)' : 'rotate(0deg)'"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      {{ payment.name }}
                    </div>
                  </td>
                  <td class="table-cell">
                    <span class="badge bg-subtle text-muted">{{ payment.category }}</span>
                  </td>
                  <td class="table-cell text-right font-mono text-xs" [ngClass]="amountClass">{{ payment.monthlyAmount | appCurrency }}</td>
                  <td class="table-cell text-right font-mono text-xs" [ngClass]="amountClass">{{ payment.annualAmount | appCurrency }}</td>
                </tr>
                @if (expandedPaymentId === payment.id) {
                  <tr class="history-row">
                    <td colspan="4" class="p-0 border-none">
                      <div class="history-panel">
                        <div class="px-5 pt-3 pb-4 border-t border-card-border/50 history-panel-bg">
                          @if (isLoadingCurrentHistory) {
                            <div class="h-40 flex items-center justify-center gap-2.5">
                              <div class="w-5 h-5 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin"></div>
                              <span class="text-xs text-muted">Loading history...</span>
                            </div>
                          } @else if (hasCurrentHistory) {
                            <div class="flex items-center justify-between mb-3">
                              <span class="text-[11px] font-semibold text-muted uppercase tracking-wider">Amount History</span>
                              <span class="text-[11px] text-muted font-mono">{{ currentHistoryData.labels!.length }} periods</span>
                            </div>
                            <div class="h-40">
                              <canvas baseChart
                                role="img"
                                [attr.aria-label]="'Line chart showing payment amount history for ' + payment.name"
                                [datasets]="currentHistoryData.datasets"
                                [labels]="currentHistoryData.labels"
                                [options]="historyChartOptions"
                                type="line">
                              </canvas>
                            </div>
                          } @else {
                            <div class="h-40 flex items-center justify-center">
                              <p class="text-xs text-muted">No history data available.</p>
                            </div>
                          }
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .history-row td {
      padding: 0 !important;
    }
    .history-panel {
      animation: historyReveal 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      overflow: hidden;
    }
    .history-panel-bg {
      background: linear-gradient(180deg, rgba(24,26,35,0.6) 0%, transparent 100%);
    }
    @keyframes historyReveal {
      from {
        max-height: 0;
        opacity: 0;
      }
      to {
        max-height: 280px;
        opacity: 1;
      }
    }
  `]
})
export class RecurringSummaryTableComponent implements OnChanges {
  @Input({ required: true }) title = '';
  @Input({ required: true }) items: RecurringPaymentSummary[] = [];
  @Input({ required: true }) emptyMessage = '';
  @Input({ required: true }) tone: TableTone = 'expense';
  @Input({ required: true }) historyChartOptions!: ChartConfiguration<'line'>['options'];
  @Input() historyState: RecurringSummaryHistoryState = { paymentId: null, loading: false, data: { labels: [], datasets: [] } };

  @Output() historyRequested = new EventEmitter<string>();

  readonly columns: { key: SortColumn; label: string; align?: 'left' | 'right' }[] = [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'monthlyAmount', label: 'Monthly', align: 'right' },
    { key: 'annualAmount', label: 'Annual', align: 'right' },
  ];

  activeSort: { column: SortColumn; direction: SortDirection } = {
    column: 'annualAmount',
    direction: 'desc',
  };
  expandedPaymentId: string | null = null;
  sortedItems: RecurringPaymentSummary[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.sortedItems = this.getSortedItems(this.items);
      this.expandedPaymentId = null;
    }
  }

  get amountClass(): string {
    return this.tone === 'income' ? 'text-accent' : 'text-coral';
  }

  get isLoadingCurrentHistory(): boolean {
    return this.historyState.loading && this.historyState.paymentId === this.expandedPaymentId;
  }

  get currentHistoryData(): ChartConfiguration<'line'>['data'] {
    return this.historyState.paymentId === this.expandedPaymentId
      ? this.historyState.data
      : { labels: [], datasets: [] };
  }

  get hasCurrentHistory(): boolean {
    const labels = this.currentHistoryData.labels;
    return Array.isArray(labels) && labels.length > 0;
  }

  sortBy(column: SortColumn): void {
    this.activeSort = this.activeSort.column === column
      ? { column, direction: this.activeSort.direction === 'desc' ? 'asc' : 'desc' }
      : { column, direction: 'desc' };
    this.expandedPaymentId = null;
    this.sortedItems = this.getSortedItems(this.items);
  }

  togglePaymentHistory(paymentId: string): void {
    if (this.expandedPaymentId === paymentId) {
      this.expandedPaymentId = null;
      return;
    }

    this.expandedPaymentId = paymentId;
    this.historyRequested.emit(paymentId);
  }

  private getSortedItems(items: RecurringPaymentSummary[]): RecurringPaymentSummary[] {
    const direction = this.activeSort.direction === 'asc' ? 1 : -1;

    return items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const comparison = this.compareValues(left.item, right.item, this.activeSort.column);
        return comparison === 0 ? left.index - right.index : comparison * direction;
      })
      .map(({ item }) => item);
  }

  private compareValues(left: RecurringPaymentSummary, right: RecurringPaymentSummary, column: SortColumn): number {
    if (column === 'monthlyAmount' || column === 'annualAmount') {
      return left[column] - right[column];
    }

    return left[column].localeCompare(right[column], undefined, { sensitivity: 'accent' });
  }
}
