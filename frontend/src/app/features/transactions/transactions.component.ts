import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionsService } from '../../api/generated';
import { TransactionDto } from '../../api/generated/model/transactionDto';
import { DateRangePickerComponent, DateRange } from '../../shared/date-range-picker.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { CURRENCY_LOCALE, CURRENCY_CODE, DEFAULT_PAGE_SIZE } from '../../shared/constants';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

type SortField = 'bookingDate' | 'partnerName' | 'amount';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-transactions',
  imports: [CommonModule, FormsModule, DateRangePickerComponent, LoadingSpinnerComponent, ErrorStateComponent],
  template: `
    <div class="animate-fade-in">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Transactions</h1>
          <p class="text-sm text-muted mt-0.5">Browse and search all imported transactions</p>
        </div>
        @if (totalElements > 0) {
          <div class="text-xs text-muted">
            {{ totalElements }} transaction{{ totalElements === 1 ? '' : 's' }}
          </div>
        }
      </div>
    
      <!-- Filter bar -->
      <div class="bg-card border border-card-border rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Date range picker -->
          <app-date-range-picker
            [from]="from"
            [to]="to"
            (rangeChanged)="onDateRangeChanged($event)">
          </app-date-range-picker>
    
          <!-- Search -->
          <div class="relative flex-1 min-w-0">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input type="text"
              [ngModel]="searchText"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Search partner or details..."
              class="w-full bg-subtle border border-card-border rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent transition-colors">
            </div>
    
            <!-- Sort -->
            <select [ngModel]="sortField"
              (ngModelChange)="onSortChange($event)"
              class="text-xs bg-card border border-card-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-subtle shrink-0">
            <option value="bookingDate">Sort by date</option>
            <option value="partnerName">Sort by partner</option>
            <option value="amount">Sort by amount</option>
          </select>
    
          <!-- Sort direction -->
          <button (click)="toggleSortDirection()"
            class="w-9 h-9 flex items-center justify-center bg-card border border-card-border rounded-xl text-muted hover:text-white hover:bg-card-hover transition-colors shrink-0"
            [title]="sortDir === 'asc' ? 'Ascending' : 'Descending'">
            @if (sortDir === 'asc') {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
              </svg>
            }
            @if (sortDir === 'desc') {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
              </svg>
            }
          </button>
        </div>
      </div>
    
      <!-- Loading -->
      @if (loading) {
        <app-loading-spinner message="Loading transactions..." />
      }

      <!-- Error state -->
      @if (!loading && error) {
        <app-error-state [message]="error" (retry)="loadTransactions()" />
      }
    
      <!-- Empty state -->
      @if (!loading && !error && transactions.length === 0) {
        <div class="glass-card p-10 sm:p-16 text-center animate-slide-up">
          <div class="w-16 h-16 rounded-2xl bg-violet-dim flex items-center justify-center mx-auto mb-5">
            <svg class="w-7 h-7 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 class="text-base font-semibold text-white mb-1">No transactions found</h3>
          <p class="text-sm text-muted">{{ searchText || from || to ? 'Try adjusting your filters.' : 'Upload a CSV file to get started.' }}</p>
        </div>
      }
    
      <!-- Mobile card view -->
      @if (!loading && !error && transactions.length > 0) {
        <div class="sm:hidden space-y-2 animate-slide-up">
          @for (tx of transactions; track tx) {
            <div class="glass-card p-3.5">
              <div class="flex items-start justify-between gap-2 mb-1.5">
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
    
      <!-- Desktop table view -->
      @if (!loading && !error && transactions.length > 0) {
        <div class="hidden sm:block glass-card overflow-hidden animate-slide-up">
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead>
                <tr class="border-b border-card-border">
                  <th class="table-header">Date</th>
                  <th class="table-header">Partner</th>
                  <th class="table-header text-right">Amount</th>
                  <th class="table-header">Details</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-card-border">
                @for (tx of transactions; track tx) {
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
          </div>
        </div>
      }
    
      <!-- Pagination -->
      @if (!loading && !error && totalPages > 1) {
        <div
          class="flex items-center justify-between mt-4 px-1">
          <button (click)="goToPage(page - 1)"
            [disabled]="page === 0"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                [ngClass]="{
                  'text-muted/30 cursor-not-allowed': page === 0,
                  'text-muted hover:text-white hover:bg-card': page > 0
                }">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Previous
          </button>
          <span class="text-xs text-muted">
            Page {{ page + 1 }} of {{ totalPages }}
          </span>
          <button (click)="goToPage(page + 1)"
            [disabled]="page >= totalPages - 1"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                [ngClass]="{
                  'text-muted/30 cursor-not-allowed': page >= totalPages - 1,
                  'text-muted hover:text-white hover:bg-card': page < totalPages - 1
                }">
            Next
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      }
    </div>
    `
})
export class TransactionsComponent implements OnInit, OnDestroy {
  private transactionsService = inject(TransactionsService);

  transactions: TransactionDto[] = [];
  loading = false;
  error: string | null = null;

  // Filters
  from: string | null = null;
  to: string | null = null;
  searchText = '';
  sortField: SortField = 'bookingDate';
  sortDir: SortDir = 'desc';

  // Pagination
  page = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  totalElements = 0;
  totalPages = 0;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(text => {
      this.searchText = text;
      this.page = 0;
      this.loadTransactions();
    });

    this.loadTransactions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDateRangeChanged(range: DateRange): void {
    this.from = range.from;
    this.to = range.to;
    this.page = 0;
    this.loadTransactions();
  }

  onSearchChange(text: string): void {
    this.searchSubject.next(text);
  }

  onSortChange(field: SortField): void {
    this.sortField = field;
    this.page = 0;
    this.loadTransactions();
  }

  toggleSortDirection(): void {
    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    this.page = 0;
    this.loadTransactions();
  }

  goToPage(p: number): void {
    if (p < 0 || p >= this.totalPages) return;
    this.page = p;
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.loading = true;
    this.error = null;

    this.transactionsService.getTransactions(
      this.from || undefined,
      this.to || undefined,
      this.searchText || undefined,
      this.page,
      this.pageSize,
      this.sortField,
      this.sortDir
    ).subscribe({
      next: (result) => {
        this.transactions = result.content;
        this.totalElements = result.totalElements;
        this.totalPages = result.totalPages;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load transactions. Please try again.';
        this.loading = false;
      }
    });
  }

  formatAmount(amount: number): string {
    const prefix = amount >= 0 ? '+' : '';
    return prefix + new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: CURRENCY_CODE }).format(amount);
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
