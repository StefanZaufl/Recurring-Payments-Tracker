import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecurringPaymentsService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { TransactionDto } from '../../api/generated/model/transactionDto';
import { DateRangePickerComponent, DateRange } from '../../shared/date-range-picker.component';
import { ModalComponent } from '../../shared/modal.component';
import { CURRENCY_LOCALE, CURRENCY_CODE } from '../../shared/constants';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-payment-transactions-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DateRangePickerComponent, ModalComponent],
  template: `
    <app-modal
      title="Transactions"
      [subtitle]="payment.name"
      size="lg"
      (closeModal)="closed.emit()">
      <span subtitle-extra class="badge text-[10px]"
          [ngClass]="{
            'bg-violet-dim text-violet': payment.frequency === 'MONTHLY',
            'bg-amber-dim text-amber': payment.frequency === 'QUARTERLY',
            'bg-sky-dim text-sky': payment.frequency === 'YEARLY'
          }">
        {{ payment.frequency }}
      </span>
      <!-- Filter bar -->
      <div toolbar class="px-5 py-3 border-b border-card-border shrink-0 flex items-center justify-between gap-3">
        <app-date-range-picker
          [from]="txFilterFrom"
          [to]="txFilterTo"
          (rangeChanged)="onDateRangeChanged($event)">
        </app-date-range-picker>
        @if (!loading && !error) {
          <span class="text-xs text-muted whitespace-nowrap">
            {{ filteredTransactions.length }} transaction{{ filteredTransactions.length === 1 ? '' : 's' }}
          </span>
        }
      </div>
      <!-- Loading -->
      @if (loading) {
        <div class="flex flex-col items-center justify-center py-12 gap-3">
          <div class="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
          <span class="text-xs text-muted">Loading transactions...</span>
        </div>
      }
      <!-- Error -->
      @if (!loading && error) {
        <div class="p-5">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-coral-dim flex items-center justify-center shrink-0">
              <svg class="w-4 h-4 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p class="text-sm text-coral font-medium">{{ error }}</p>
              <button (click)="loadTransactions()" class="mt-2 text-xs text-muted hover:text-white transition-colors">Try again</button>
            </div>
          </div>
        </div>
      }
      <!-- Empty -->
      @if (!loading && !error && filteredTransactions.length === 0) {
        <div class="py-10 px-5 text-center">
          <div class="w-12 h-12 rounded-xl bg-subtle flex items-center justify-center mx-auto mb-3">
            <svg class="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p class="text-sm text-muted">No transactions found{{ txFilterFrom || txFilterTo ? ' for this date range' : '' }}.</p>
        </div>
      }
      <!-- Mobile transaction cards -->
      @if (!loading && !error && filteredTransactions.length > 0) {
        <div class="sm:hidden p-3 space-y-2">
          @for (tx of filteredTransactions; track tx) {
            <div class="bg-subtle rounded-xl p-3">
              <div class="flex items-start justify-between gap-2 mb-1">
                <p class="text-sm font-medium text-white truncate min-w-0 flex-1">{{ tx.partnerName || 'Unknown' }}</p>
                <p class="font-mono text-sm font-semibold shrink-0"
                  [class.text-accent]="tx.amount >= 0"
                  [class.text-coral]="tx.amount < 0">
                  {{ formatAmount(tx.amount) }}
                </p>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs text-muted">{{ formatDate(tx.bookingDate) }}</span>
                @if (tx.details) {
                  <span class="text-xs text-muted/60 truncate max-w-[50%] text-right">{{ tx.details }}</span>
                }
              </div>
            </div>
          }
        </div>
      }
      <!-- Desktop transaction table -->
      @if (!loading && !error && filteredTransactions.length > 0) {
        <table class="min-w-full hidden sm:table">
          <thead>
            <tr class="border-b border-card-border">
              <th class="table-header">Date</th>
              <th class="table-header">Partner</th>
              <th class="table-header text-right">Amount</th>
              <th class="table-header">Details</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-card-border">
            @for (tx of filteredTransactions; track tx) {
              <tr class="hover:bg-card-hover transition-colors">
                <td class="table-cell text-muted whitespace-nowrap">{{ formatDate(tx.bookingDate) }}</td>
                <td class="table-cell font-medium text-white">{{ tx.partnerName || 'Unknown' }}</td>
                <td class="table-cell text-right font-mono text-xs font-medium whitespace-nowrap"
                  [class.text-accent]="tx.amount >= 0"
                  [class.text-coral]="tx.amount < 0">
                  {{ formatAmount(tx.amount) }}
                </td>
                <td class="table-cell text-muted/70 max-w-xs truncate">{{ tx.details || '-' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </app-modal>
  `
})
export class PaymentTransactionsModalComponent implements OnInit, OnDestroy {
  private recurringPaymentsService = inject(RecurringPaymentsService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  @Input({ required: true }) payment!: RecurringPaymentDto;
  @Output() closed = new EventEmitter<void>();

  allTransactions: TransactionDto[] = [];
  filteredTransactions: TransactionDto[] = [];
  loading = false;
  error: string | null = null;
  txFilterFrom: string | null = null;
  txFilterTo: string | null = null;

  ngOnInit(): void {
    this.loadTransactions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTransactions(): void {
    this.loading = true;
    this.error = null;
    this.allTransactions = [];
    this.filteredTransactions = [];

    this.recurringPaymentsService.getRecurringPaymentTransactions(this.payment.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (transactions) => {
        this.allTransactions = transactions;
        this.applyFilter();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load transactions.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onDateRangeChanged(range: DateRange): void {
    this.txFilterFrom = range.from;
    this.txFilterTo = range.to;
    this.applyFilter();
  }

  formatAmount(amount: number): string {
    const prefix = amount >= 0 ? '+' : '';
    return prefix + new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: CURRENCY_CODE }).format(amount);
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private applyFilter(): void {
    this.filteredTransactions = this.allTransactions.filter(tx => {
      if (this.txFilterFrom && tx.bookingDate < this.txFilterFrom) return false;
      if (this.txFilterTo && tx.bookingDate > this.txFilterTo) return false;
      return true;
    }).sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
  }
}
