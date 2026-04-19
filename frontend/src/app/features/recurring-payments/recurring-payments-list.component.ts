import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { RecurringPaymentsService, CategoriesService, AdditionalRuleGroupsService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { AdditionalRuleGroupDto } from '../../api/generated/model/additionalRuleGroupDto';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { FrequencyBadgeComponent } from '../../shared/frequency-badge.component';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { PaymentCategoryDialogComponent } from './payment-category-dialog.component';
import { PaymentTransactionsModalComponent } from './payment-transactions-modal.component';
import { PaymentRulesModalComponent } from './payment-rules-modal.component';
import { parseBooleanParam, parseEnumParam } from '../../shared/query-param-utils';
import { Subject, forkJoin, takeUntil } from 'rxjs';

type RecurringSortBy = 'amount' | 'name';
type RecurringTab = 'RECURRING' | 'GROUPED' | 'ADDITIONAL';

interface RecurringPaymentsUrlState {
  showInactive: boolean;
  filterFrequency: string;
  sortBy: RecurringSortBy;
  selectedTab: RecurringTab;
}

const RECURRING_SORT_OPTIONS: readonly RecurringSortBy[] = ['amount', 'name'];
const RECURRING_TAB_OPTIONS: readonly RecurringTab[] = ['RECURRING', 'GROUPED', 'ADDITIONAL'];
const FREQUENCY_OPTIONS = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

@Component({
  selector: 'app-recurring-payments-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, LoadingSpinnerComponent, ErrorStateComponent, FrequencyBadgeComponent, CurrencyFormatPipe, PaymentCategoryDialogComponent, PaymentTransactionsModalComponent, PaymentRulesModalComponent],
  template: `
    <div class="animate-fade-in">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Recurring Payments</h1>
          <p class="text-sm text-muted mt-0.5">Manage detected payment patterns</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <a routerLink="/recurring-payments/create"
            class="btn-primary text-xs flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Payment
          </a>
          <label class="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <div class="relative">
              <input type="checkbox" [(ngModel)]="showInactive"
                class="sr-only peer"
                (ngModelChange)="onShowInactiveChange($event)">
              <div class="w-8 h-[18px] bg-subtle rounded-full peer-checked:bg-accent/30 transition-colors"></div>
              <div class="absolute top-[3px] left-[3px] w-3 h-3 bg-muted rounded-full peer-checked:translate-x-3.5 peer-checked:bg-accent transition-all"></div>
            </div>
            Show inactive
          </label>
          <select [(ngModel)]="filterFrequency" (ngModelChange)="onFrequencyChange($event)"
            class="text-xs bg-card border border-card-border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-subtle">
            <option value="">All frequencies</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          <select [(ngModel)]="sortBy" (ngModelChange)="onSortByChange($event)"
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

      @if (!loading && !error) {
        <!-- Tabs -->
        <div class="flex gap-1 mb-4 border-b border-card-border">
          <button
            class="px-4 py-2 text-sm font-medium transition-colors relative"
            [class.text-white]="selectedTab === 'RECURRING'"
            [class.text-muted]="selectedTab !== 'RECURRING'"
            (click)="onTabChange('RECURRING')">
            Recurring
            <span class="text-xs ml-1 text-muted">({{ recurringCount }})</span>
            @if (selectedTab === 'RECURRING') {
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"></div>
            }
          </button>
          <button
            class="px-4 py-2 text-sm font-medium transition-colors relative"
            [class.text-white]="selectedTab === 'GROUPED'"
            [class.text-muted]="selectedTab !== 'GROUPED'"
            (click)="onTabChange('GROUPED')">
            Grouped
            <span class="text-xs ml-1 text-muted">({{ groupedCount }})</span>
            @if (selectedTab === 'GROUPED') {
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"></div>
            }
          </button>
          <button
            class="px-4 py-2 text-sm font-medium transition-colors relative"
            [class.text-white]="selectedTab === 'ADDITIONAL'"
            [class.text-muted]="selectedTab !== 'ADDITIONAL'"
            (click)="onTabChange('ADDITIONAL')">
            Additional
            <span class="text-xs ml-1 text-muted">({{ additionalGroups.length }})</span>
            @if (selectedTab === 'ADDITIONAL') {
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"></div>
            }
          </button>
        </div>

        @if (selectedTab === 'ADDITIONAL') {
          <div class="glass-card overflow-hidden animate-slide-up">
            <div class="px-5 py-4 border-b border-card-border">
              <h2 class="text-sm font-semibold text-white">Additional Rule Groups</h2>
              <p class="text-[11px] text-muted mt-1">A transaction is excluded if it matches any group. Within a group, all rules must match. Counts use transactions from the last 2 years.</p>
            </div>
            <div class="divide-y divide-card-border">
              @for (group of additionalGroups; track group.id) {
                <div class="px-5 py-4 hover:bg-card-hover transition-colors cursor-pointer"
                  role="button"
                  tabindex="0"
                  (click)="openAdditionalGroup(group.id)"
                  (keydown.enter)="openAdditionalGroup(group.id)">
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-sm font-medium text-white">{{ group.name }}</h3>
                        <span class="badge bg-subtle text-muted text-[10px]">{{ group.rules.length }} rule{{ group.rules.length === 1 ? '' : 's' }}</span>
                        <span class="badge bg-amber-dim text-amber text-[10px]">{{ group.excludedTransactionCount }} excluded</span>
                      </div>
                      <p class="text-[11px] text-muted mt-1">All rules must match</p>
                      <div class="mt-2 flex flex-col gap-1.5">
                        @for (rule of group.rules; track rule.id) {
                          <div class="text-[11px] text-muted/80 bg-subtle rounded-lg px-2 py-1">{{ formatRuleType(rule.ruleType) }}: {{ formatRuleSummary(rule) }}</div>
                        }
                      </div>
                    </div>
                    <button (click)="confirmDeleteAdditionalGroup(group); $event.stopPropagation()"
                      class="text-muted hover:text-coral transition-colors p-1"
                      title="Delete group">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              }
              <button (click)="createAdditionalGroup()"
                class="w-full px-5 py-4 text-left text-sm text-accent hover:bg-card-hover transition-colors">
                Add Additional Payments Rule Group
              </button>
            </div>
          </div>
        }

        <!-- Empty state -->
        @if (selectedTab !== 'ADDITIONAL' && filteredPayments.length === 0) {
          <div class="glass-card p-10 sm:p-16 text-center animate-slide-up">
            <div class="w-16 h-16 rounded-2xl bg-violet-dim flex items-center justify-center mx-auto mb-5">
              <svg class="w-7 h-7 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
              </svg>
            </div>
            @if (selectedTab === 'RECURRING') {
              <h3 class="text-base font-semibold text-white mb-1">No recurring payments found</h3>
              <p class="text-sm text-muted mb-5">Upload bank transactions to detect patterns or create one manually.</p>
            } @else {
              <h3 class="text-base font-semibold text-white mb-1">No grouped payments found</h3>
              <p class="text-sm text-muted mb-5">Create a grouped payment to track irregular related expenses like groceries.</p>
            }
            <a routerLink="/recurring-payments/create" class="btn-primary">Create Payment</a>
          </div>
        }

        <!-- Mobile card view -->
        @if (selectedTab !== 'ADDITIONAL' && filteredPayments.length > 0) {
          <div class="sm:hidden space-y-3 animate-slide-up">
            @for (payment of filteredPayments; track payment.id) {
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
                    {{ payment.averageAmount | appCurrency:true }}
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
                      @if (payment.categoryColor) {
                        <span class="w-2 h-2 rounded-full shrink-0 mr-1" [style.background-color]="payment.categoryColor"></span>
                      }
                      {{ payment.categoryName || 'Uncategorized' }}
                      <svg class="w-3 h-3 ml-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                  </div>
                  <button (click)="confirmDelete(payment); $event.stopPropagation()"
                    class="text-muted hover:text-coral transition-colors p-1">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            }
          </div>
        }

        <!-- Desktop table view -->
        @if (selectedTab !== 'ADDITIONAL' && filteredPayments.length > 0) {
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
                    <th class="table-header"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-card-border">
                  @for (payment of filteredPayments; track payment.id) {
                    <tr
                      class="group hover:bg-card-hover transition-colors cursor-pointer"
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
                          @if (payment.categoryColor) {
                            <span class="w-2 h-2 rounded-full shrink-0 mr-1" [style.background-color]="payment.categoryColor"></span>
                          }
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
                        {{ payment.averageAmount | appCurrency:true }}
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
                          <span class="inline-block w-1.5 h-1.5 rounded-full mr-1" [ngClass]="{'bg-accent': payment.isActive, 'bg-muted': !payment.isActive}"></span>{{ payment.isActive ? 'Active' : 'Inactive' }}
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
                      <td class="table-cell">
                        <button (click)="confirmDelete(payment); $event.stopPropagation()"
                          class="text-muted hover:text-coral transition-colors p-1 opacity-0 group-hover:opacity-100"
                          title="Delete payment">
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
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
      }

      <!-- Delete confirmation dialog -->
      @if (deletePayment) {
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="button" tabindex="0" aria-label="Close dialog"
          (click)="deletePayment = null" (keydown.enter)="deletePayment = null" (keydown.escape)="deletePayment = null">
          <div class="glass-card p-6 max-w-sm w-full" role="dialog" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
            <h3 class="text-base font-semibold text-white mb-2">Delete Payment</h3>
            <p class="text-sm text-muted mb-4">Are you sure you want to delete <strong class="text-white">{{ deletePayment.name }}</strong>? This will unlink all associated transactions.</p>
            <div class="flex gap-3 justify-end">
              <button (click)="deletePayment = null" class="text-sm text-muted hover:text-white transition-colors px-3 py-1.5">Cancel</button>
              <button (click)="executeDelete()" class="text-sm bg-coral/20 text-coral hover:bg-coral/30 transition-colors px-3 py-1.5 rounded-lg">Delete</button>
            </div>
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
  private additionalRuleGroupsService = inject(AdditionalRuleGroupsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  private dataLoaded = false;
  payments: RecurringPaymentDto[] = [];
  filteredPayments: RecurringPaymentDto[] = [];
  additionalGroups: AdditionalRuleGroupDto[] = [];
  categories: CategoryDto[] = [];
  loading = false;
  error: string | null = null;
  showInactive = false;
  filterFrequency = '';
  sortBy: RecurringSortBy = 'amount';
  selectedTab: RecurringTab = 'RECURRING';
  recurringCount = 0;
  groupedCount = 0;

  // Dialog/modal state
  dialogPayment: RecurringPaymentDto | null = null;
  transactionsPayment: RecurringPaymentDto | null = null;
  rulesPayment: RecurringPaymentDto | null = null;
  deletePayment: RecurringPaymentDto | null = null;
  deleteAdditionalGroup: AdditionalRuleGroupDto | null = null;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(queryParamMap => {
      this.applyUrlState(this.parseUrlState(queryParamMap));

      if (!this.dataLoaded) {
        this.loadData();
        return;
      }

      this.applyFilter();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilter(): void {
    const activeFilter = this.payments.filter(p => {
      if (!this.showInactive && !p.isActive) return false;
      if (this.filterFrequency && p.frequency !== this.filterFrequency) return false;
      return true;
    });

    this.recurringCount = activeFilter.filter(p => p.paymentType === 'RECURRING').length;
    this.groupedCount = activeFilter.filter(p => p.paymentType === 'GROUPED').length;

    this.filteredPayments = this.selectedTab === 'ADDITIONAL'
      ? []
      : activeFilter.filter(p => p.paymentType === this.selectedTab);

    if (this.sortBy === 'amount') {
      this.filteredPayments.sort((a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount));
    } else {
      this.filteredPayments.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  onShowInactiveChange(showInactive: boolean): void {
    this.showInactive = showInactive;
    this.syncUrlWithState();
  }

  onFrequencyChange(frequency: string): void {
    this.filterFrequency = frequency;
    this.syncUrlWithState();
  }

  onSortByChange(sortBy: RecurringSortBy): void {
    this.sortBy = sortBy;
    this.syncUrlWithState();
  }

  onTabChange(tab: RecurringTab): void {
    if (this.selectedTab === tab) {
      return;
    }

    this.selectedTab = tab;
    this.syncUrlWithState();
  }

  toggleActive(payment: RecurringPaymentDto): void {
    this.recurringPaymentsService.updateRecurringPayment(payment.id, {
      isActive: !payment.isActive
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const idx = this.payments.findIndex(p => p.id === payment.id);
        if (idx >= 0) this.payments[idx] = { ...this.payments[idx], ...updated };
        this.applyFilter();
        this.cdr.markForCheck();
      }
    });
  }

  // Delete

  confirmDelete(payment: RecurringPaymentDto): void {
    this.deletePayment = payment;
  }

  executeDelete(): void {
    if (!this.deletePayment) return;
    const id = this.deletePayment.id;
    this.recurringPaymentsService.deleteRecurringPayment(id)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.payments = this.payments.filter(p => p.id !== id);
          this.deletePayment = null;
          this.applyFilter();
          this.cdr.markForCheck();
        }
      });
  }

  confirmDeleteAdditionalGroup(group: AdditionalRuleGroupDto): void {
    this.deleteAdditionalGroup = group;
    if (confirm(`Delete Additional rule group "${group.name}"?`)) {
      this.additionalRuleGroupsService.deleteAdditionalRuleGroup(group.id)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.deleteAdditionalGroup = null;
            this.loadData();
          }
        });
    }
  }

  openAdditionalGroup(id: string): void {
    this.router.navigate(['/recurring-payments/additional'], { queryParams: { group: id } });
  }

  createAdditionalGroup(): void {
    this.router.navigate(['/recurring-payments/additional'], { queryParams: { new: 'true' } });
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
        this.applyFilter();
        this.cdr.markForCheck();
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
      categories: this.categoriesService.getCategories(),
      additionalGroups: this.additionalRuleGroupsService.getAdditionalRuleGroups()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ payments, categories, additionalGroups }) => {
        this.payments = payments;
        this.categories = categories;
        this.additionalGroups = additionalGroups;
        this.dataLoaded = true;
        this.applyFilter();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load recurring payments. Please try again.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private parseUrlState(queryParamMap: { get(name: string): string | null }): RecurringPaymentsUrlState {
    return {
      showInactive: parseBooleanParam(queryParamMap.get('showInactive')) ?? false,
      filterFrequency: parseEnumParam(queryParamMap.get('frequency'), FREQUENCY_OPTIONS) ?? '',
      sortBy: parseEnumParam(queryParamMap.get('sort'), RECURRING_SORT_OPTIONS) ?? 'amount',
      selectedTab: parseEnumParam(queryParamMap.get('tab'), RECURRING_TAB_OPTIONS) ?? 'RECURRING',
    };
  }

  private applyUrlState(state: RecurringPaymentsUrlState): void {
    this.showInactive = state.showInactive;
    this.filterFrequency = state.filterFrequency;
    this.sortBy = state.sortBy;
    this.selectedTab = state.selectedTab;
  }

  private syncUrlWithState(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.buildQueryParams(),
    });
  }

  private buildQueryParams(): Params {
    return {
      showInactive: this.showInactive ? 'true' : null,
      frequency: this.filterFrequency || null,
      sort: this.sortBy !== 'amount' ? this.sortBy : null,
      tab: this.selectedTab !== 'RECURRING' ? this.selectedTab : null,
    };
  }

  formatRuleType(type: string): string {
    switch (type) {
      case 'JARO_WINKLER': return 'Jaro-Winkler';
      case 'REGEX': return 'Regex';
      case 'AMOUNT': return 'Amount';
      default: return type;
    }
  }

  formatRuleSummary(rule: { ruleType: string; targetField?: string; text?: string; strict?: boolean; threshold?: number; amount?: number; fluctuationRange?: number }): string {
    switch (rule.ruleType) {
      case 'JARO_WINKLER':
        return `${rule.targetField}: "${rule.text}" (threshold: ${rule.threshold})${rule.strict ? ' [strict]' : ''}`;
      case 'REGEX':
        return `${rule.targetField}: /${rule.text}/${rule.strict ? ' [strict]' : ''}`;
      case 'AMOUNT':
        return `${rule.amount} +/- ${rule.fluctuationRange}`;
      default:
        return '';
    }
  }
}
