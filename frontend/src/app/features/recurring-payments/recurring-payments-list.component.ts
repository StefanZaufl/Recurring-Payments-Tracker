import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecurringPaymentsService, CategoriesService, RecurringPaymentRulesService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { TransactionDto } from '../../api/generated/model/transactionDto';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { RuleDto } from '../../api/generated/model/ruleDto';
import { RuleType } from '../../api/generated/model/ruleType';
import { TargetField } from '../../api/generated/model/targetField';
import { CreateRuleRequest } from '../../api/generated/model/createRuleRequest';
import { CategoryCreateComponent } from '../../shared/category-create.component';
import { DateRangePickerComponent, DateRange } from '../../shared/date-range-picker.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { FrequencyBadgeComponent } from '../../shared/frequency-badge.component';
import { CURRENCY_LOCALE, CURRENCY_CODE } from '../../shared/constants';
import { Subject, forkJoin, takeUntil } from 'rxjs';

@Component({
  selector: 'app-recurring-payments-list',
  imports: [CommonModule, FormsModule, RouterLink, CategoryCreateComponent, DateRangePickerComponent, LoadingSpinnerComponent, ErrorStateComponent, FrequencyBadgeComponent],
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
    
      <!-- Category dialog backdrop -->
      @if (dialogPayment) {
        <div
          class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="button"
          tabindex="0"
          aria-label="Close category dialog"
          (click)="closeCategoryDialog()"
          (keydown.enter)="closeCategoryDialog()">
          <div class="glass-card w-full max-w-sm p-0 animate-slide-up border-subtle"
            role="dialog"
            tabindex="-1"
            (click)="$event.stopPropagation()"
            (keydown.enter)="$event.stopPropagation()">
            <!-- Dialog header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-card-border">
              <div class="min-w-0 flex-1">
                <h3 class="text-sm font-semibold text-white">Set Category</h3>
                <p class="text-xs text-muted truncate mt-0.5">{{ dialogPayment.name }}</p>
              </div>
              <button (click)="closeCategoryDialog()"
                class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors shrink-0 ml-3">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <!-- Existing categories -->
            <div class="px-5 py-3 max-h-60 overflow-y-auto">
              <p class="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Existing categories</p>
              <!-- None option -->
              <button (click)="selectCategory(null)"
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left transition-colors mb-1"
                    [ngClass]="{
                      'bg-subtle text-white': !dialogPayment.categoryId,
                      'text-muted hover:bg-card-hover hover:text-white': dialogPayment.categoryId
                    }">
                <span>None</span>
                @if (!dialogPayment.categoryId) {
                  <svg class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                }
              </button>
              @for (cat of categories; track cat) {
                <button
                  (click)="selectCategory(cat.id)"
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left transition-colors mb-1"
                    [ngClass]="{
                      'bg-subtle text-white': dialogPayment.categoryId === cat.id,
                      'text-muted hover:bg-card-hover hover:text-white': dialogPayment.categoryId !== cat.id
                    }">
                  <span>{{ cat.name }}</span>
                  @if (dialogPayment.categoryId === cat.id) {
                    <svg class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  }
                </button>
              }
            </div>
            <!-- Create new category -->
            <div class="px-5 py-4 border-t border-card-border">
              <p class="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Create new</p>
              <app-category-create (created)="onDialogCategoryCreated($event)"></app-category-create>
            </div>
          </div>
        </div>
      }
    
      <!-- Transactions modal backdrop -->
      @if (transactionsPayment) {
        <div
          class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="button"
          tabindex="0"
          aria-label="Close transactions modal"
          (click)="closeTransactionsModal()"
          (keydown.enter)="closeTransactionsModal()">
          <div class="glass-card w-full max-w-3xl p-0 animate-slide-up border-subtle max-h-[85vh] flex flex-col"
            role="dialog"
            tabindex="-1"
            (click)="$event.stopPropagation()"
            (keydown.enter)="$event.stopPropagation()">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-card-border shrink-0">
              <div class="min-w-0 flex-1">
                <h3 class="text-sm font-semibold text-white">Transactions</h3>
                <div class="flex items-center gap-2 mt-0.5">
                  <p class="text-xs text-muted truncate">{{ transactionsPayment.name }}</p>
                  <span class="badge text-[10px]"
                      [ngClass]="{
                        'bg-violet-dim text-violet': transactionsPayment.frequency === 'MONTHLY',
                        'bg-amber-dim text-amber': transactionsPayment.frequency === 'QUARTERLY',
                        'bg-sky-dim text-sky': transactionsPayment.frequency === 'YEARLY'
                      }">
                    {{ transactionsPayment.frequency }}
                  </span>
                </div>
              </div>
              <button (click)="closeTransactionsModal()"
                class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors shrink-0 ml-3">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <!-- Filter bar -->
            <div class="px-5 py-3 border-b border-card-border shrink-0 flex items-center justify-between gap-3">
              <app-date-range-picker
                [from]="txFilterFrom"
                [to]="txFilterTo"
                (rangeChanged)="onTxDateRangeChanged($event)">
              </app-date-range-picker>
              @if (!transactionsLoading && !transactionsError) {
                <span class="text-xs text-muted whitespace-nowrap">
                  {{ filteredTransactions.length }} transaction{{ filteredTransactions.length === 1 ? '' : 's' }}
                </span>
              }
            </div>
            <!-- Content area (scrollable) -->
            <div class="overflow-y-auto flex-1 min-h-0">
              <!-- Loading -->
              @if (transactionsLoading) {
                <div class="flex flex-col items-center justify-center py-12 gap-3">
                  <div class="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                  <span class="text-xs text-muted">Loading transactions...</span>
                </div>
              }
              <!-- Error -->
              @if (!transactionsLoading && transactionsError) {
                <div class="p-5">
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-coral-dim flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm text-coral font-medium">{{ transactionsError }}</p>
                      <button (click)="openTransactionsModal(transactionsPayment!)" class="mt-2 text-xs text-muted hover:text-white transition-colors">Try again</button>
                    </div>
                  </div>
                </div>
              }
              <!-- Empty -->
              @if (!transactionsLoading && !transactionsError && filteredTransactions.length === 0) {
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
              @if (!transactionsLoading && !transactionsError && filteredTransactions.length > 0) {
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
              @if (!transactionsLoading && !transactionsError && filteredTransactions.length > 0) {
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
            </div>
          </div>
        </div>
      }
    
      <!-- Rules modal backdrop -->
      @if (rulesPayment) {
        <div
          class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="button"
          tabindex="0"
          aria-label="Close rules modal"
          (click)="closeRulesModal()"
          (keydown.enter)="closeRulesModal()">
          <div class="glass-card w-full max-w-2xl p-0 animate-slide-up border-subtle max-h-[85vh] flex flex-col"
            role="dialog"
            tabindex="-1"
            (click)="$event.stopPropagation()"
            (keydown.enter)="$event.stopPropagation()">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-card-border shrink-0">
              <div class="min-w-0 flex-1">
                <h3 class="text-sm font-semibold text-white">Detection Rules</h3>
                <p class="text-xs text-muted truncate mt-0.5">{{ rulesPayment.name }}</p>
              </div>
              <button (click)="closeRulesModal()"
                class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors shrink-0 ml-3">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <!-- Content area (scrollable) -->
            <div class="overflow-y-auto flex-1 min-h-0">
              <!-- Loading -->
              @if (rulesLoading) {
                <div class="flex flex-col items-center justify-center py-12 gap-3">
                  <div class="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                  <span class="text-xs text-muted">Loading rules...</span>
                </div>
              }
              <!-- Error -->
              @if (!rulesLoading && rulesError) {
                <div class="p-5">
                  <p class="text-sm text-coral font-medium">{{ rulesError }}</p>
                </div>
              }
              <!-- Rules list -->
              @if (!rulesLoading && !rulesError) {
                <div class="p-5 space-y-3">
                  @if (rules.length === 0) {
                    <div class="text-center py-6">
                      <p class="text-sm text-muted">No rules configured. Add a rule below.</p>
                    </div>
                  }
                  @for (rule of rules; track rule) {
                    <div class="bg-subtle rounded-xl p-4">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1.5">
                            <span class="badge text-[10px]"
                            [ngClass]="{
                              'bg-violet-dim text-violet': rule.ruleType === 'JARO_WINKLER',
                              'bg-amber-dim text-amber': rule.ruleType === 'REGEX',
                              'bg-sky-dim text-sky': rule.ruleType === 'AMOUNT'
                            }">
                              {{ formatRuleType(rule.ruleType) }}
                            </span>
                            @if (rule.targetField) {
                              <span class="text-[11px] text-muted">
                                {{ formatTargetField(rule.targetField) }}
                              </span>
                            }
                          </div>
                          <p class="text-xs text-muted/80 break-all">{{ formatRuleSummary(rule) }}</p>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button (click)="startEditRule(rule)"
                            class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card-hover text-muted hover:text-white transition-colors">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                          </button>
                          <button (click)="deleteRule(rule)"
                            class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-coral-dim text-muted hover:text-coral transition-colors">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
            <!-- Add/Edit rule form -->
            @if (!rulesLoading && !rulesError) {
              <div class="px-5 py-4 border-t border-card-border shrink-0">
                <p class="text-[11px] text-muted uppercase tracking-wider font-medium mb-3">
                  {{ editingRule ? 'Edit rule' : 'Add rule' }}
                </p>
                <!-- Rule type selector -->
                @if (!editingRule) {
                  <div class="mb-3">
                    <select [(ngModel)]="ruleFormType" (change)="onRuleTypeChange()"
                      class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-subtle">
                      <option value="JARO_WINKLER">Jaro-Winkler (Fuzzy Text Match)</option>
                      <option value="REGEX">Regex (Pattern Match)</option>
                      <option value="AMOUNT">Amount (Value Range)</option>
                    </select>
                  </div>
                }
                <!-- Text rule fields -->
                @if (ruleFormType === 'JARO_WINKLER' || ruleFormType === 'REGEX') {
                  <div class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label for="ruleTargetField" class="text-[11px] text-muted mb-1 block">Target Field</label>
                        <select id="ruleTargetField" [(ngModel)]="ruleFormTargetField"
                          class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-subtle">
                          <option value="PARTNER_NAME">Partner Name</option>
                          <option value="PARTNER_IBAN">Partner IBAN</option>
                          <option value="DETAILS">Details</option>
                        </select>
                      </div>
                      @if (ruleFormType === 'JARO_WINKLER') {
                        <div>
                          <label for="ruleThreshold" class="text-[11px] text-muted mb-1 block">Threshold</label>
                          <input id="ruleThreshold" type="number" [(ngModel)]="ruleFormThreshold" min="0" max="1" step="0.05"
                            class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-subtle"
                            placeholder="0.85">
                        </div>
                      }
                    </div>
                    <div>
                      <label for="ruleText" class="text-[11px] text-muted mb-1 block">{{ ruleFormType === 'REGEX' ? 'Pattern' : 'Text' }}</label>
                      <input id="ruleText" type="text" [(ngModel)]="ruleFormText"
                        class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-subtle"
                        [placeholder]="ruleFormType === 'REGEX' ? 'e.g. netflix.*' : 'e.g. netflix'">
                    </div>
                    <label class="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
                      <input type="checkbox" [(ngModel)]="ruleFormStrict" class="rounded border-card-border bg-card text-accent focus:ring-0 focus:ring-offset-0">
                      Strict (fail on null values)
                    </label>
                  </div>
                }
                <!-- Amount rule fields -->
                @if (ruleFormType === 'AMOUNT') {
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="ruleAmount" class="text-[11px] text-muted mb-1 block">Amount</label>
                      <input id="ruleAmount" type="number" [(ngModel)]="ruleFormAmount" step="0.01"
                        class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-subtle"
                        placeholder="-12.99">
                    </div>
                    <div>
                      <label for="ruleFluctuationRange" class="text-[11px] text-muted mb-1 block">Fluctuation Range</label>
                      <input id="ruleFluctuationRange" type="number" [(ngModel)]="ruleFormFluctuationRange" min="0" step="0.01"
                        class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-subtle"
                        placeholder="1.30">
                    </div>
                  </div>
                }
                <!-- Form actions -->
                <div class="flex items-center gap-2 mt-4">
                  <button (click)="saveRule()"
                    [disabled]="ruleSaving"
                    class="btn-primary text-xs px-4 py-2">
                    {{ ruleSaving ? 'Saving...' : (editingRule ? 'Update Rule' : 'Add Rule') }}
                  </button>
                  @if (editingRule) {
                    <button (click)="cancelEditRule()"
                      class="text-xs text-muted hover:text-white transition-colors px-3 py-2">
                      Cancel
                    </button>
                  }
                  @if (ruleFormError) {
                    <span class="text-xs text-coral ml-2">{{ ruleFormError }}</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
    `
})
export class RecurringPaymentsListComponent implements OnInit, OnDestroy {
  private recurringPaymentsService = inject(RecurringPaymentsService);
  private categoriesService = inject(CategoriesService);
  private rulesService = inject(RecurringPaymentRulesService);

  private destroy$ = new Subject<void>();
  payments: RecurringPaymentDto[] = [];
  filteredPayments: RecurringPaymentDto[] = [];
  categories: CategoryDto[] = [];
  loading = false;
  error: string | null = null;
  showInactive = false;
  filterFrequency = '';
  sortBy: 'amount' | 'name' = 'amount';

  // Category dialog state
  dialogPayment: RecurringPaymentDto | null = null;

  // Transactions modal state
  transactionsPayment: RecurringPaymentDto | null = null;
  allTransactions: TransactionDto[] = [];
  filteredTransactions: TransactionDto[] = [];
  transactionsLoading = false;
  transactionsError: string | null = null;
  txFilterFrom: string | null = null;
  txFilterTo: string | null = null;

  // Rules modal state
  rulesPayment: RecurringPaymentDto | null = null;
  rules: RuleDto[] = [];
  rulesLoading = false;
  rulesError: string | null = null;
  editingRule: RuleDto | null = null;
  ruleSaving = false;
  ruleFormError: string | null = null;

  // Rule form fields
  ruleFormType = 'JARO_WINKLER';
  ruleFormTargetField = 'PARTNER_NAME';
  ruleFormText = '';
  ruleFormStrict = true;
  ruleFormThreshold = 0.85;
  ruleFormAmount: number | null = null;
  ruleFormFluctuationRange: number | null = null;

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

  updateCategory(payment: RecurringPaymentDto, categoryId: string): void {
    this.recurringPaymentsService.updateRecurringPayment(payment.id, {
      categoryId: categoryId || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const idx = this.payments.findIndex(p => p.id === payment.id);
        if (idx >= 0) this.payments[idx] = { ...this.payments[idx], ...updated };
      }
    });
  }

  openCategoryDialog(payment: RecurringPaymentDto): void {
    this.dialogPayment = payment;
  }

  closeCategoryDialog(): void {
    this.dialogPayment = null;
  }

  selectCategory(categoryId: string | null): void {
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
    this.selectCategory(category.id);
  }

  openTransactionsModal(payment: RecurringPaymentDto): void {
    this.transactionsPayment = payment;
    this.transactionsLoading = true;
    this.transactionsError = null;
    this.txFilterFrom = null;
    this.txFilterTo = null;
    this.allTransactions = [];
    this.filteredTransactions = [];

    this.recurringPaymentsService.getRecurringPaymentTransactions(payment.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (transactions) => {
        this.allTransactions = transactions;
        this.applyTransactionFilter();
        this.transactionsLoading = false;
      },
      error: (err) => {
        this.transactionsError = err.error?.message || 'Failed to load transactions.';
        this.transactionsLoading = false;
      }
    });
  }

  closeTransactionsModal(): void {
    this.transactionsPayment = null;
    this.allTransactions = [];
    this.filteredTransactions = [];
    this.transactionsError = null;
    this.txFilterFrom = null;
    this.txFilterTo = null;
  }

  applyTransactionFilter(): void {
    this.filteredTransactions = this.allTransactions.filter(tx => {
      if (this.txFilterFrom && tx.bookingDate < this.txFilterFrom) return false;
      if (this.txFilterTo && tx.bookingDate > this.txFilterTo) return false;
      return true;
    }).sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
  }

  onTxDateRangeChanged(range: DateRange): void {
    this.txFilterFrom = range.from;
    this.txFilterTo = range.to;
    this.applyTransactionFilter();
  }

  formatAmount(amount: number): string {
    const prefix = amount >= 0 ? '+' : '';
    return prefix + new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: CURRENCY_CODE }).format(amount);
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' });
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

  // Rules modal methods

  openRulesModal(payment: RecurringPaymentDto): void {
    this.rulesPayment = payment;
    this.rulesLoading = true;
    this.rulesError = null;
    this.rules = [];
    this.editingRule = null;
    this.resetRuleForm();

    this.rulesService.getRules(payment.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (rules) => {
        this.rules = rules;
        this.rulesLoading = false;
      },
      error: (err) => {
        this.rulesError = err.error?.message || 'Failed to load rules.';
        this.rulesLoading = false;
      }
    });
  }

  closeRulesModal(): void {
    this.rulesPayment = null;
    this.rules = [];
    this.rulesError = null;
    this.editingRule = null;
    this.resetRuleForm();
  }

  startEditRule(rule: RuleDto): void {
    this.editingRule = rule;
    this.ruleFormType = rule.ruleType;
    this.ruleFormTargetField = rule.targetField || 'PARTNER_NAME';
    this.ruleFormText = rule.text || '';
    this.ruleFormStrict = rule.strict !== false;
    this.ruleFormThreshold = rule.threshold || 0.85;
    this.ruleFormAmount = rule.amount ?? null;
    this.ruleFormFluctuationRange = rule.fluctuationRange ?? null;
    this.ruleFormError = null;
  }

  cancelEditRule(): void {
    this.editingRule = null;
    this.resetRuleForm();
  }

  onRuleTypeChange(): void {
    this.ruleFormError = null;
  }

  saveRule(): void {
    if (!this.rulesPayment) return;
    this.ruleSaving = true;
    this.ruleFormError = null;

    if (this.editingRule) {
      this.rulesService.updateRule(this.rulesPayment.id, this.editingRule.id, {
        targetField: this.isTextRule() ? this.ruleFormTargetField as TargetField : undefined,
        text: this.isTextRule() ? this.ruleFormText : undefined,
        strict: this.isTextRule() ? this.ruleFormStrict : undefined,
        threshold: this.ruleFormType === 'JARO_WINKLER' ? this.ruleFormThreshold : undefined,
        amount: this.ruleFormType === 'AMOUNT' ? this.ruleFormAmount! : undefined,
        fluctuationRange: this.ruleFormType === 'AMOUNT' ? this.ruleFormFluctuationRange! : undefined,
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => this.onRuleSaved(),
        error: (err) => {
          this.ruleFormError = err.error?.message || 'Failed to update rule.';
          this.ruleSaving = false;
        }
      });
    } else {
      const request: CreateRuleRequest = {
        ruleType: this.ruleFormType as RuleType,
        targetField: this.isTextRule() ? this.ruleFormTargetField as TargetField : undefined,
        text: this.isTextRule() ? this.ruleFormText : undefined,
        strict: this.isTextRule() ? this.ruleFormStrict : undefined,
        threshold: this.ruleFormType === 'JARO_WINKLER' ? this.ruleFormThreshold : undefined,
        amount: this.ruleFormType === 'AMOUNT' ? this.ruleFormAmount! : undefined,
        fluctuationRange: this.ruleFormType === 'AMOUNT' ? this.ruleFormFluctuationRange! : undefined,
      };

      this.rulesService.createRule(this.rulesPayment.id, request).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => this.onRuleSaved(),
        error: (err) => {
          this.ruleFormError = err.error?.message || 'Failed to create rule.';
          this.ruleSaving = false;
        }
      });
    }
  }

  deleteRule(rule: RuleDto): void {
    if (!this.rulesPayment) return;
    this.rulesService.deleteRule(this.rulesPayment.id, rule.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.onRuleSaved(),
      error: (err) => {
        this.rulesError = err.error?.message || 'Failed to delete rule.';
      }
    });
  }

  private onRuleSaved(): void {
    if (!this.rulesPayment) return;
    const paymentId = this.rulesPayment.id;

    forkJoin({
      updatedPayment: this.rulesService.reEvaluateRecurringPayment(paymentId),
      rules: this.rulesService.getRules(paymentId)
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ updatedPayment, rules }) => {
        const idx = this.payments.findIndex(p => p.id === paymentId);
        if (idx >= 0) {
          this.payments[idx] = { ...updatedPayment, ruleCount: rules.length };
        }
        if (this.rulesPayment?.id === paymentId) {
          this.rulesPayment = { ...updatedPayment, ruleCount: rules.length };
        }
        this.rules = rules;
        this.applyFilter();
      }
    });

    this.editingRule = null;
    this.resetRuleForm();
    this.ruleSaving = false;
  }

  private isTextRule(): boolean {
    return this.ruleFormType === 'JARO_WINKLER' || this.ruleFormType === 'REGEX';
  }

  private resetRuleForm(): void {
    this.ruleFormType = 'JARO_WINKLER';
    this.ruleFormTargetField = 'PARTNER_NAME';
    this.ruleFormText = '';
    this.ruleFormStrict = true;
    this.ruleFormThreshold = 0.85;
    this.ruleFormAmount = null;
    this.ruleFormFluctuationRange = null;
    this.ruleFormError = null;
    this.ruleSaving = false;
  }

  formatRuleType(type: string): string {
    switch (type) {
      case 'JARO_WINKLER': return 'Jaro-Winkler';
      case 'REGEX': return 'Regex';
      case 'AMOUNT': return 'Amount';
      default: return type;
    }
  }

  formatTargetField(field: string): string {
    switch (field) {
      case 'PARTNER_NAME': return 'Partner Name';
      case 'PARTNER_IBAN': return 'Partner IBAN';
      case 'DETAILS': return 'Details';
      default: return field;
    }
  }

  formatRuleSummary(rule: RuleDto): string {
    switch (rule.ruleType) {
      case 'JARO_WINKLER':
        return `"${rule.text}" (threshold: ${rule.threshold})${rule.strict ? ' [strict]' : ''}`;
      case 'REGEX':
        return `/${rule.text}/${rule.strict ? ' [strict]' : ''}`;
      case 'AMOUNT':
        return `${this.formatCurrency(rule.amount!)} +/- ${this.formatCurrency(rule.fluctuationRange!)}`;
      default:
        return '';
    }
  }
}
