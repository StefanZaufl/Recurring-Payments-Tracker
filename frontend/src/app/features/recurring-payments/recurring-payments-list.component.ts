import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecurringPaymentsService, CategoriesService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { FrequencyBadgeComponent } from '../../shared/frequency-badge.component';
import { CURRENCY_LOCALE, CURRENCY_CODE } from '../../shared/constants';
import { PaymentCategoryDialogComponent } from './payment-category-dialog.component';
import { PaymentTransactionsModalComponent } from './payment-transactions-modal.component';
import { PaymentRulesModalComponent } from './payment-rules-modal.component';
import { Subject, forkJoin, takeUntil } from 'rxjs';

@Component({
  selector: 'app-recurring-payments-list',
  imports: [CommonModule, FormsModule, RouterLink, LoadingSpinnerComponent, ErrorStateComponent, FrequencyBadgeComponent, PaymentCategoryDialogComponent, PaymentTransactionsModalComponent, PaymentRulesModalComponent],
  template: `
    <div class="animate-fade-in">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Recurring Payments</h1>
          <p class="text-sm text-muted mt-0.5">Manage detected payment patterns</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <label class="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <div class="relative">
              <input type="checkbox" [(ngModel)]="showInactive"
                class="sr-only peer"
                (change)="applyFilter()">
              <div class="w-8 h-[18px] bg-subtle rounded-full peer-checked:bg-accent/30 transition-colors"></div>
              <div class="absolute top-[3px] left-[3px] w-3 h-3 bg-muted rounded-full peer-checked:translate-x-3.5 peer-checked:bg-accent transition-all"></div>
            </div>
            Show inactive
          </label>
          <select [(ngModel)]="filterFrequency" (change)="applyFilter()"
            class="text-xs bg-card border border-card-border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-subtle">
            <option value="">All frequencies</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          <select [(ngModel)]="sortBy" (change)="applyFilter()"
            class="text-xs bg-card border border-card-border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-subtle">
            <option value="amount">Sort by amount</option>
            <option value="name">Sort by name</option>
          </select>
        </div>
      </div>

      <!-- Loading -->
      @if (loading) {
        <app-loading-spinner message="Loading payments..." />
      }

      <!-- Error state -->
      @if (!loading && error) {
        <app-error-state [message]="error" (retry)="loadData()" />
      }

      <!-- Empty state -->
      @if (!loading && !error && filteredPayments.length === 0) {
        <div class="glass-card p-10 sm:p-16 text-center animate-slide-up">
          <div class="w-16 h-16 rounded-2xl bg-violet-dim flex items-center justify-center mx-auto mb-5">
            <svg class="w-7 h-7 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
          </div>
          <h3 class="text-base font-semibold text-white mb-1">No recurring payments found</h3>
          <p class="text-sm text-muted mb-5">Upload bank transactions to detect patterns.</p>
          <a routerLink="/configure" class="btn-primary">Upload CSV</a>
        </div>
      }

      <!-- Mobile card view -->
      @if (!loading && filteredPayments.length > 0) {
        <div class="sm:hidden space-y-3 animate-slide-up">
          @for (payment of filteredPayments; track payment) {
            <div
              class="glass-card p-4 transition-opacity cursor-pointer"
              [class.opacity-40]="!payment.isActive"
              role="button"
              tabindex="0"
              (click)="openTransactionsModal(payment)"
              (keydown.enter)="openTransactionsModal(payment)">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white truncate">{{ payment.name }}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <app-frequency-badge [frequency]="payment.frequency" />
                    <span class="badge"
                      [ngClass]="{
                        'bg-accent-dim text-accent': payment.isIncome,
                        'bg-coral-dim text-coral': !payment.isIncome
                      }">
                      {{ payment.isIncome ? 'Income' : 'Expense' }}
                    </span>
                    <button (click)="openRulesModal(payment); $event.stopPropagation()"
                      class="badge cursor-pointer bg-subtle text-muted hover:bg-card-hover transition-colors">
                      {{ payment.ruleCount }} rule{{ payment.ruleCount === 1 ? '' : 's' }}
                    </button>
                  </div>
                </div>
                <p class="font-mono text-sm font-semibold shrink-0 ml-3"
                  [class.text-accent]="payment.isIncome"
                  [class.text-coral]="!payment.isIncome">
                  {{ payment.isIncome ? '+' : '-' }}{{ formatCurrency(abs(payment.averageAmount)) }}
                </p>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <button (click)="toggleActive(payment); $event.stopPropagation()"
                    class="badge cursor-pointer transition-colors"
                      [ngClass]="{
                        'bg-accent-dim text-accent': payment.isActive,
                        'bg-subtle text-muted': !payment.isActive
                      }">
                    {{ payment.isActive ? 'Active' : 'Inactive' }}
                  </button>
                  <button (click)="openCategoryDialog(payment); $event.stopPropagation()"
                    class="badge cursor-pointer transition-colors hover:bg-card-hover"
                      [ngClass]="{
                        'bg-subtle text-muted': payment.categoryName,
                        'bg-subtle text-muted/50': !payment.categoryName
                      }">
                    {{ payment.categoryName || 'Uncategorized' }}
                    <svg class="w-3 h-3 ml-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Desktop table view -->
      @if (!loading && filteredPayments.length > 0) {
        <div class="hidden sm:block glass-card overflow-hidden animate-slide-up">
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead>
                <tr class="border-b border-card-border">
                  <th class="table-header">Name</th>
                  <th class="table-header">Category</th>
                  <th class="table-header">Frequency</th>
                  <th class="table-header text-right">Amount</th>
                  <th class="table-header">Type</th>
                  <th class="table-header">Status</th>
                  <th class="table-header">Rules</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-card-border">
                @for (payment of filteredPayments; track payment) {
                  <tr
                    class="hover:bg-card-hover transition-colors cursor-pointer"
                    [class.opacity-40]="!payment.isActive"
                    (click)="openTransactionsModal(payment)">
                    <td class="table-cell font-medium text-white">{{ payment.name }}</td>
                    <td class="table-cell">
                      <button (click)="openCategoryDialog(payment); $event.stopPropagation()"
                        class="badge cursor-pointer transition-colors hover:bg-card-hover group"
                          [ngClass]="{
                            'bg-subtle text-muted': payment.categoryName,
                            'bg-subtle text-muted/50': !payment.categoryName
                          }">
                        {{ payment.categoryName || 'Uncategorized' }}
                        <svg class="w-3 h-3 ml-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                    </td>
                    <td class="table-cell">
                      <app-frequency-badge [frequency]="payment.frequency" />
                    </td>
                    <td class="table-cell text-right font-mono text-xs font-medium"
                      [class.text-accent]="payment.isIncome"
                      [class.text-coral]="!payment.isIncome">
                      {{ payment.isIncome ? '+' : '-' }}{{ formatCurrency(abs(payment.averageAmount)) }}
                    </td>
                    <td class="table-cell">
                      <span class="badge"
                        [ngClass]="{
                          'bg-accent-dim text-accent': payment.isIncome,
                          'bg-coral-dim text-coral': !payment.isIncome
                        }">
                        {{ payment.isIncome ? 'Income' : 'Expense' }}
                      </span>
                    </td>
                    <td class="table-cell">
                      <button (click)="toggleActive(payment); $event.stopPropagation()"
                        class="badge cursor-pointer transition-colors"
                          [ngClass]="{
                            'bg-accent-dim text-accent': payment.isActive,
                            'bg-subtle text-muted': !payment.isActive
                          }">
                        {{ payment.isActive ? 'Active' : 'Inactive' }}
                      </button>
                    </td>
                    <td class="table-cell">
                      <button (click)="openRulesModal(payment); $event.stopPropagation()"
                        class="badge cursor-pointer bg-subtle text-muted hover:bg-card-hover transition-colors group">
                        {{ payment.ruleCount }} rule{{ payment.ruleCount === 1 ? '' : 's' }}
                        <svg class="w-3 h-3 ml-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Category dialog -->
      @if (dialogPayment) {
        <app-payment-category-dialog
          [payment]="dialogPayment"
          [categories]="categories"
          (categorySelected)="onCategorySelected($event)"
          (categoryCreated)="onDialogCategoryCreated($event)"
          (closed)="closeCategoryDialog()" />
      }

      <!-- Transactions modal -->
      @if (transactionsPayment) {
        <app-payment-transactions-modal
          [payment]="transactionsPayment"
          (closed)="closeTransactionsModal()" />
      }

      <!-- Rules modal -->
      @if (rulesPayment) {
        <app-payment-rules-modal
          [payment]="rulesPayment"
          (paymentUpdated)="onPaymentUpdatedFromRules($event)"
          (closed)="closeRulesModal()" />
      }
    </div>
    `
})
export class RecurringPaymentsListComponent implements OnInit, OnDestroy {
  private recurringPaymentsService = inject(RecurringPaymentsService);
  private categoriesService = inject(CategoriesService);

  private destroy$ = new Subject<void>();
  payments: RecurringPaymentDto[] = [];
  filteredPayments: RecurringPaymentDto[] = [];
  categories: CategoryDto[] = [];
  loading = false;
  error: string | null = null;
  showInactive = false;
  filterFrequency = '';
  sortBy: 'amount' | 'name' = 'amount';

  // Dialog/modal state
  dialogPayment: RecurringPaymentDto | null = null;
  transactionsPayment: RecurringPaymentDto | null = null;
  rulesPayment: RecurringPaymentDto | null = null;

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: CURRENCY_CODE }).format(value);
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  applyFilter(): void {
    this.filteredPayments = this.payments.filter(p => {
      if (!this.showInactive && !p.isActive) return false;
      if (this.filterFrequency && p.frequency !== this.filterFrequency) return false;
      return true;
    });
    if (this.sortBy === 'amount') {
      this.filteredPayments.sort((a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount));
    } else {
      this.filteredPayments.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  toggleActive(payment: RecurringPaymentDto): void {
    this.recurringPaymentsService.updateRecurringPayment(payment.id, {
      isActive: !payment.isActive
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const idx = this.payments.findIndex(p => p.id === payment.id);
        if (idx >= 0) this.payments[idx] = { ...this.payments[idx], ...updated };
        this.applyFilter();
      }
    });
  }

  // Category dialog

  openCategoryDialog(payment: RecurringPaymentDto): void {
    this.dialogPayment = payment;
  }

  closeCategoryDialog(): void {
    this.dialogPayment = null;
  }

  onCategorySelected(categoryId: string | null): void {
    if (!this.dialogPayment) return;
    const payment = this.dialogPayment;
    this.recurringPaymentsService.updateRecurringPayment(payment.id, {
      categoryId: categoryId || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const idx = this.payments.findIndex(p => p.id === payment.id);
        if (idx >= 0) this.payments[idx] = { ...this.payments[idx], ...updated };
        this.closeCategoryDialog();
      }
    });
  }

  onDialogCategoryCreated(category: CategoryDto): void {
    this.categories = [...this.categories, category];
    this.onCategorySelected(category.id);
  }

  // Transactions modal

  openTransactionsModal(payment: RecurringPaymentDto): void {
    this.transactionsPayment = payment;
  }

  closeTransactionsModal(): void {
    this.transactionsPayment = null;
  }

  // Rules modal

  openRulesModal(payment: RecurringPaymentDto): void {
    this.rulesPayment = payment;
  }

  closeRulesModal(): void {
    this.rulesPayment = null;
  }

  onPaymentUpdatedFromRules(event: { payment: RecurringPaymentDto; ruleCount: number }): void {
    const idx = this.payments.findIndex(p => p.id === event.payment.id);
    if (idx >= 0) {
      this.payments[idx] = { ...event.payment, ruleCount: event.ruleCount };
    }
    if (this.rulesPayment?.id === event.payment.id) {
      this.rulesPayment = { ...event.payment, ruleCount: event.ruleCount };
    }
    this.applyFilter();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      payments: this.recurringPaymentsService.getRecurringPayments(),
      categories: this.categoriesService.getCategories()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ payments, categories }) => {
        this.payments = payments;
        this.categories = categories;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load recurring payments. Please try again.';
        this.loading = false;
      }
    });
  }
}
