import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RecurringPaymentsService, TransactionsService } from '../../api/generated';
import { TransactionDto } from '../../api/generated/model/transactionDto';
import { CreateRuleRequest } from '../../api/generated/model/createRuleRequest';
import { OverlappingPaymentDto } from '../../api/generated/model/overlappingPaymentDto';
import { RuleType } from '../../api/generated/model/ruleType';
import { TargetField } from '../../api/generated/model/targetField';
import { PaymentType } from '../../api/generated/model/paymentType';
import { Frequency } from '../../api/generated/model/frequency';
import { SimulationDraftType } from '../../api/generated/model/simulationDraftType';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { formatLocalDate } from '../../shared/date-range-presets';
import { Subject, takeUntil, debounceTime, switchMap } from 'rxjs';
import { LocalRule, RuleEditorComponent } from './rule-editor.component';

@Component({
  selector: 'app-create-payment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyFormatPipe, RuleEditorComponent],
  template: `
    <div class="animate-fade-in">
      <!-- Header -->
      <div class="flex items-center gap-4 mb-6 sm:mb-8">
        <a routerLink="/recurring-payments"
          class="w-8 h-8 flex items-center justify-center rounded-lg bg-subtle text-muted hover:text-white hover:bg-card-hover transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </a>
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Create Payment</h1>
          <p class="text-sm text-muted mt-0.5">Define rules to match transactions</p>
        </div>
      </div>

      <!-- Two column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

        <!-- Left: Transaction Preview (3/5) -->
        <div class="lg:col-span-3 space-y-4">
          <div class="glass-card overflow-hidden">
            <!-- Transaction header -->
            <div class="px-5 py-4 border-b border-card-border flex items-center justify-between">
              <div>
                @if (simulationActive && rules.length > 0 && matchingIds.size > 0) {
                  <h2 class="text-sm font-semibold text-white">
                    Matching <span class="text-accent">{{ matchingIds.size }}</span> transaction{{ matchingIds.size === 1 ? '' : 's' }}
                  </h2>
                  <p class="text-[11px] text-muted mt-0.5">of {{ totalTransactions }} additional transactions from the last 2 years</p>
                } @else if (simulationActive && rules.length > 0) {
                  <h2 class="text-sm font-semibold text-white">No matches</h2>
                  <p class="text-[11px] text-muted mt-0.5">Adjust your rules to match transactions</p>
                } @else {
                  <h2 class="text-sm font-semibold text-white">Additional Transactions</h2>
                  <p class="text-[11px] text-muted mt-0.5">Showing transactions from the last 2 years</p>
                }
              </div>
              <div class="flex items-center gap-2">
                @if (simulating) {
                  <div class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                }
                @if (simulationActive && rules.length > 0) {
                  <label class="flex items-center gap-2 text-[11px] text-muted cursor-pointer select-none">
                    <div class="relative">
                      <input type="checkbox" [(ngModel)]="showOnlyMatches"
                        class="sr-only peer">
                      <div class="w-7 h-[16px] bg-subtle rounded-full peer-checked:bg-accent/30 transition-colors"></div>
                      <div class="absolute top-[2px] left-[2px] w-3 h-3 bg-muted rounded-full peer-checked:translate-x-3 peer-checked:bg-accent transition-all"></div>
                    </div>
                    Matches only
                  </label>
                }
              </div>
            </div>

            <!-- Transaction list -->
            @if (loadingTransactions || !additionalFiltersLoaded) {
              <div class="flex flex-col items-center justify-center py-16 gap-3">
                <div class="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                <span class="text-xs text-muted">Loading transactions...</span>
              </div>
            } @else {
              <div class="divide-y divide-card-border">
                @for (tx of displayedTransactions; track tx.id) {
                  <div class="px-5 py-3 flex items-center gap-4 transition-colors"
                    [class.border-l-2]="isMatch(tx.id)"
                    [class.border-l-accent]="isMatch(tx.id)"
                    [class.bg-accent/5]="isMatch(tx.id)">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-medium text-white truncate">{{ tx.partnerName || 'Unknown' }}</span>
                        @if (isMatch(tx.id)) {
                          <span class="badge bg-accent-dim text-accent text-[10px]">match</span>
                        }
                      </div>
                      <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[11px] text-muted">{{ tx.bookingDate }}</span>
                        @if (tx.details) {
                          <span class="text-[11px] text-muted/60 truncate max-w-[200px]">{{ tx.details }}</span>
                        }
                      </div>
                    </div>
                    <span class="font-mono text-xs font-medium shrink-0"
                      [class.text-accent]="tx.amount >= 0"
                      [class.text-coral]="tx.amount < 0">
                      {{ tx.amount | appCurrency:true }}
                    </span>
                  </div>
                } @empty {
                  <div class="py-12 text-center">
                    <p class="text-sm text-muted">No transactions to display.</p>
                  </div>
                }
              </div>

              <!-- Pagination -->
              @if (totalPages > 1 && !(showOnlyMatches && simulationActive)) {
                <div class="px-5 py-3 border-t border-card-border flex items-center justify-between">
                  <span class="text-[11px] text-muted">Page {{ currentPage + 1 }} of {{ totalPages }}</span>
                  <div class="flex items-center gap-1">
                    <button (click)="goToPage(currentPage - 1)" [disabled]="currentPage === 0"
                      class="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <button (click)="goToPage(currentPage + 1)" [disabled]="currentPage >= totalPages - 1"
                      class="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              }
            }
          </div>
        </div>

        <!-- Right: Payment Form (2/5) -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Payment details card -->
          <div class="glass-card p-5 space-y-4">
            <h2 class="text-sm font-semibold text-white">Payment Details</h2>

            <!-- Name -->
            <div>
              <label for="paymentName" class="text-[11px] text-muted mb-1 block uppercase tracking-wider font-medium">Name</label>
              <input id="paymentName" type="text" [(ngModel)]="paymentName"
                class="w-full text-sm bg-subtle border border-card-border rounded-xl px-4 py-2.5 text-white placeholder-muted/50 focus:outline-none focus:border-accent/40 transition-colors"
                placeholder="e.g. Groceries, Netflix">
            </div>

            <!-- Type toggle -->
            <div>
              <span class="text-[11px] text-muted mb-1.5 block uppercase tracking-wider font-medium">Type</span>
              <div class="grid grid-cols-2 gap-2">
                <button (click)="paymentType = 'RECURRING'"
                  class="py-2 px-3 rounded-xl text-xs font-medium transition-all border"
                  [class.bg-accent/10]="paymentType === 'RECURRING'"
                  [class.border-accent/30]="paymentType === 'RECURRING'"
                  [class.text-accent]="paymentType === 'RECURRING'"
                  [class.bg-subtle]="paymentType !== 'RECURRING'"
                  [class.border-card-border]="paymentType !== 'RECURRING'"
                  [class.text-muted]="paymentType !== 'RECURRING'">
                  Recurring
                </button>
                <button (click)="paymentType = 'GROUPED'"
                  class="py-2 px-3 rounded-xl text-xs font-medium transition-all border"
                  [class.bg-violet/10]="paymentType === 'GROUPED'"
                  [class.border-violet/30]="paymentType === 'GROUPED'"
                  [class.text-violet]="paymentType === 'GROUPED'"
                  [class.bg-subtle]="paymentType !== 'GROUPED'"
                  [class.border-card-border]="paymentType !== 'GROUPED'"
                  [class.text-muted]="paymentType !== 'GROUPED'">
                  Grouped
                </button>
              </div>
              @if (paymentType === 'RECURRING') {
                <p class="text-[11px] text-muted/70 mt-1.5">Matches fixed, predictable payments like subscriptions or salary.</p>
              } @else if (paymentType === 'GROUPED') {
                <p class="text-[11px] text-muted/70 mt-1.5">Tracks irregular but related expenses like groceries or fuel, averaging the total per period.</p>
              }
            </div>

            <!-- Frequency -->
            <div>
              <label for="paymentFrequency" class="text-[11px] text-muted mb-1 block uppercase tracking-wider font-medium">Frequency</label>
              <select id="paymentFrequency" [(ngModel)]="paymentFrequency"
                class="w-full text-sm bg-subtle border border-card-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent/40 transition-colors">
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
          </div>

          <app-rule-editor
            [rules]="rules"
            (rulesChange)="onRulesChange($event)"
            (firstRuleAdded)="showOnlyMatches = true" />

          <!-- Overlap warning -->
          @if (overlappingPayments.length > 0) {
            <div class="bg-amber-dim border border-amber/20 rounded-2xl p-4 animate-fade-in">
              <div class="flex items-start gap-3">
                <svg class="w-4 h-4 text-amber shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p class="text-xs font-medium text-amber mb-1">Rule overlap detected</p>
                  <p class="text-[11px] text-amber/80">
                    Matching transactions overlap with:
                    @for (op of overlappingPayments; track op.id; let last = $last) {
                      <strong class="text-amber">{{ op.name }}</strong>{{ last ? '' : ', ' }}
                    }
                  </p>
                </div>
              </div>
            </div>
          }

          <!-- Submit -->
          <div class="flex items-center gap-3">
            <button (click)="submitPayment()" [disabled]="submitting || !canSubmit()"
              class="btn-primary flex-1 justify-center"
              [class.opacity-50]="!canSubmit()"
              [class.cursor-not-allowed]="!canSubmit()">
              @if (submitting) {
                <div class="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin"></div>
                Creating...
              } @else {
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Payment
              }
            </button>
            <a routerLink="/recurring-payments"
              class="text-sm text-muted hover:text-white transition-colors px-3 py-2.5">
              Cancel
            </a>
          </div>

          @if (submitError) {
            <div class="bg-coral-dim border border-coral/20 rounded-xl p-3 animate-fade-in">
              <p class="text-xs text-coral">{{ submitError }}</p>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class CreatePaymentComponent implements OnInit, OnDestroy {
  private recurringPaymentsService = inject(RecurringPaymentsService);
  private transactionsService = inject(TransactionsService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  private rulesChanged$ = new Subject<void>();

  // Transaction state
  allTransactions: TransactionDto[] = [];
  matchingTransactionDtos: TransactionDto[] = [];
  matchingIds = new Set<string>();
  loadingTransactions = false;
  totalTransactions = 0;
  totalPages = 0;
  currentPage = 0;
  showOnlyMatches = false;
  simulating = false;
  simulationActive = false;
  additionalFiltersLoaded = false;

  // Form state
  paymentName = '';
  paymentType: 'RECURRING' | 'GROUPED' = 'RECURRING';
  paymentFrequency = 'MONTHLY';
  rules: LocalRule[] = [];

  // Simulation results
  overlappingPayments: OverlappingPaymentDto[] = [];
  omittedAdditionalIds = new Set<string>();

  // Submit
  submitting = false;
  submitError: string | null = null;

  get displayedTransactions(): TransactionDto[] {
    if (this.showOnlyMatches && this.simulationActive && this.rules.length > 0) {
      return this.filterOmittedAdditional(this.matchingTransactionDtos);
    }
    return this.filterOmittedAdditional(this.allTransactions);
  }

  ngOnInit(): void {
    this.setupSimulationPipeline();
    this.loadTransactions(0);
    this.rulesChanged$.next();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSimulationPipeline(): void {
    this.rulesChanged$.pipe(
      debounceTime(400),
      switchMap(() => {
        this.simulating = true;
        this.cdr.markForCheck();

        return this.recurringPaymentsService.simulateRules({
          draftType: SimulationDraftType.RecurringPayment,
          rules: this.toRuleRequests()
        });
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        this.simulationActive = true;
        this.simulating = false;
        this.matchingIds = new Set(result.matchingTransactions.map(t => t.id));
        this.matchingTransactionDtos = result.matchingTransactions;
        this.overlappingPayments = result.overlappingPayments;
        this.omittedAdditionalIds = new Set((result.omittedAdditionalMatches || []).map(match => match.transactionId));
        this.additionalFiltersLoaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.simulating = false;
        this.additionalFiltersLoaded = true;
        this.cdr.markForCheck();
      }
    });
  }

  loadTransactions(page: number): void {
    this.loadingTransactions = true;
    this.currentPage = page;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 730);
    this.transactionsService.getTransactions(
      formatLocalDate(cutoff), undefined, undefined, undefined, 'ADDITIONAL', page, 20, 'bookingDate', 'desc'
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.allTransactions = result.content || [];
        this.totalTransactions = result.totalElements || 0;
        this.totalPages = result.totalPages || 0;
        this.loadingTransactions = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingTransactions = false;
        this.cdr.markForCheck();
      }
    });
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.loadTransactions(page);
    }
  }

  isMatch(id: string): boolean {
    return this.matchingIds.has(id);
  }

  private filterOmittedAdditional(transactions: TransactionDto[]): TransactionDto[] {
    if (this.omittedAdditionalIds.size === 0) {
      return transactions;
    }
    return transactions.filter(transaction => !this.omittedAdditionalIds.has(transaction.id));
  }

  onRulesChange(rules: LocalRule[]): void {
    this.rules = rules;
    this.rulesChanged$.next();
  }

  private toRuleRequests(): CreateRuleRequest[] {
    return this.rules.map(r => ({
      ruleType: r.ruleType as RuleType,
      targetField: r.targetField as TargetField | undefined,
      text: r.text,
      strict: r.strict,
      threshold: r.threshold,
      amount: r.amount,
      fluctuationRange: r.fluctuationRange,
    }));
  }

  // Submit

  canSubmit(): boolean {
    return this.paymentName.trim().length > 0 && this.rules.length > 0;
  }

  submitPayment(): void {
    if (!this.canSubmit()) return;
    this.submitting = true;
    this.submitError = null;

    const request = {
      name: this.paymentName.trim(),
      paymentType: this.paymentType as PaymentType,
      frequency: this.paymentFrequency as Frequency,
      rules: this.toRuleRequests()
    };

    this.recurringPaymentsService.createRecurringPayment(request)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.router.navigate(['/recurring-payments']);
        },
        error: (err) => {
          this.submitError = err.error?.message || 'Failed to create payment. Please try again.';
          this.submitting = false;
          this.cdr.markForCheck();
        }
      });
  }

}
