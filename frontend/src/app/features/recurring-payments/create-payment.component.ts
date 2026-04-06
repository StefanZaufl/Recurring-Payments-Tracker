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
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { Subject, takeUntil, debounceTime, switchMap, EMPTY } from 'rxjs';

interface LocalRule {
  id: string;
  ruleType: string;
  targetField?: string;
  text?: string;
  strict?: boolean;
  threshold?: number;
  amount?: number;
  fluctuationRange?: number;
}

@Component({
  selector: 'app-create-payment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyFormatPipe],
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
                @if (simulationActive && matchingIds.size > 0) {
                  <h2 class="text-sm font-semibold text-white">
                    Matching <span class="text-accent">{{ matchingIds.size }}</span> transaction{{ matchingIds.size === 1 ? '' : 's' }}
                  </h2>
                  <p class="text-[11px] text-muted mt-0.5">of {{ totalTransactions }} unlinked transactions</p>
                } @else if (simulationActive) {
                  <h2 class="text-sm font-semibold text-white">No matches</h2>
                  <p class="text-[11px] text-muted mt-0.5">Adjust your rules to match transactions</p>
                } @else {
                  <h2 class="text-sm font-semibold text-white">Unlinked Transactions</h2>
                  <p class="text-[11px] text-muted mt-0.5">{{ totalTransactions }} available for matching</p>
                }
              </div>
              <div class="flex items-center gap-2">
                @if (simulating) {
                  <div class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                }
                @if (simulationActive) {
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
            @if (loadingTransactions) {
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

          <!-- Rules card -->
          <div class="glass-card overflow-hidden">
            <div class="px-5 py-4 border-b border-card-border flex items-center justify-between">
              <h2 class="text-sm font-semibold text-white">Detection Rules</h2>
              <span class="badge bg-subtle text-muted text-[10px]">{{ rules.length }} rule{{ rules.length === 1 ? '' : 's' }}</span>
            </div>

            <!-- Existing rules -->
            @if (rules.length > 0) {
              <div class="p-4 space-y-2">
                @for (rule of rules; track rule.id) {
                  <div class="bg-subtle rounded-xl p-3 flex items-start justify-between gap-2 animate-fade-in">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="badge text-[10px]"
                          [ngClass]="{
                            'bg-violet-dim text-violet': rule.ruleType === 'JARO_WINKLER',
                            'bg-amber-dim text-amber': rule.ruleType === 'REGEX',
                            'bg-sky-dim text-sky': rule.ruleType === 'AMOUNT'
                          }">
                          {{ formatRuleType(rule.ruleType) }}
                        </span>
                        @if (rule.targetField) {
                          <span class="text-[10px] text-muted">{{ formatTargetField(rule.targetField) }}</span>
                        }
                      </div>
                      <p class="text-[11px] text-muted/80 break-all">{{ formatRuleSummary(rule) }}</p>
                    </div>
                    <div class="flex items-center gap-0.5 shrink-0">
                      <button (click)="startEditRule(rule)" aria-label="Edit rule"
                        class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-card-hover text-muted hover:text-white transition-colors">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button (click)="removeRule(rule)" aria-label="Delete rule"
                        class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-coral-dim text-muted hover:text-coral transition-colors">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Add/edit rule form -->
            @if (showRuleForm || editingRule || rules.length === 0) {
            <div class="px-5 py-4 border-t border-card-border space-y-3">
              <p class="text-[11px] text-muted uppercase tracking-wider font-medium">
                {{ editingRule ? 'Edit rule' : 'Add rule' }}
              </p>

              <!-- Rule type -->
              @if (!editingRule) {
                <select [(ngModel)]="ruleFormType" (change)="ruleFormError = null"
                  class="w-full text-xs bg-subtle border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/40">
                  <option value="JARO_WINKLER">Jaro-Winkler (Fuzzy Text Match)</option>
                  <option value="REGEX">Regex (Pattern Match)</option>
                  <option value="AMOUNT">Amount (Value Range)</option>
                </select>
              }

              <!-- Text rule fields -->
              @if (ruleFormType === 'JARO_WINKLER' || ruleFormType === 'REGEX') {
                <div class="space-y-3">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="rule-target-field" class="text-[11px] text-muted mb-1 block">Target Field</label>
                      <select id="rule-target-field" [(ngModel)]="ruleFormTargetField"
                        class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/40">
                        <option value="PARTNER_NAME">Partner Name</option>
                        <option value="PARTNER_IBAN">Partner IBAN</option>
                        <option value="DETAILS">Details</option>
                      </select>
                    </div>
                    @if (ruleFormType === 'JARO_WINKLER') {
                      <div>
                        <label for="rule-threshold" class="text-[11px] text-muted mb-1 block">Threshold</label>
                        <input id="rule-threshold" type="number" [(ngModel)]="ruleFormThreshold" min="0" max="1" step="0.05"
                          class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/40"
                          placeholder="0.85">
                      </div>
                    }
                  </div>
                  <div>
                    <label for="rule-text" class="text-[11px] text-muted mb-1 block">{{ ruleFormType === 'REGEX' ? 'Pattern' : 'Text' }}</label>
                    <input id="rule-text" type="text" [(ngModel)]="ruleFormText"
                      class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/40"
                      [placeholder]="ruleFormType === 'REGEX' ? 'e.g. netflix.*' : 'e.g. netflix'">
                  </div>
                  <label class="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
                    <input type="checkbox" [(ngModel)]="ruleFormStrict"
                      class="rounded border-card-border bg-card text-accent focus:ring-0 focus:ring-offset-0">
                    Strict (fail on null values)
                  </label>
                </div>
              }

              <!-- Amount rule fields -->
              @if (ruleFormType === 'AMOUNT') {
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="rule-amount" class="text-[11px] text-muted mb-1 block">Amount</label>
                    <input id="rule-amount" type="number" [(ngModel)]="ruleFormAmount" step="0.01"
                      class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/40"
                      placeholder="-12.99">
                  </div>
                  <div>
                    <label for="rule-fluctuation" class="text-[11px] text-muted mb-1 block">Fluctuation Range</label>
                    <input id="rule-fluctuation" type="number" [(ngModel)]="ruleFormFluctuationRange" min="0" step="0.01"
                      class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/40"
                      placeholder="1.30">
                  </div>
                </div>
              }

              <!-- Form actions -->
              <div class="flex items-center gap-2">
                <button (click)="saveRule()"
                  class="text-xs font-medium bg-subtle hover:bg-card-hover text-white px-4 py-2 rounded-lg transition-colors">
                  {{ editingRule ? 'Update' : 'Add Rule' }}
                </button>
                @if (editingRule || (showRuleForm && rules.length > 0)) {
                  <button (click)="cancelRuleForm()"
                    class="text-xs text-muted hover:text-white transition-colors px-3 py-2">
                    Cancel
                  </button>
                }
                @if (ruleFormError) {
                  <span class="text-[11px] text-coral">{{ ruleFormError }}</span>
                }
              </div>
            </div>
            } @else {
              <div class="px-5 py-4 border-t border-card-border">
                <button (click)="showRuleForm = true"
                  class="text-xs font-medium text-accent hover:text-white transition-colors flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Rule
                </button>
              </div>
            }
          </div>

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
  private currencyPipe = new CurrencyFormatPipe();

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

  // Form state
  paymentName = '';
  paymentType: 'RECURRING' | 'GROUPED' = 'RECURRING';
  paymentFrequency = 'MONTHLY';
  rules: LocalRule[] = [];

  // Rule form
  showRuleForm = false;
  editingRule: LocalRule | null = null;
  ruleFormType = 'JARO_WINKLER';
  ruleFormTargetField = 'PARTNER_NAME';
  ruleFormText = '';
  ruleFormStrict = true;
  ruleFormThreshold = 0.85;
  ruleFormAmount: number | null = null;
  ruleFormFluctuationRange: number | null = null;
  ruleFormError: string | null = null;

  // Simulation results
  overlappingPayments: OverlappingPaymentDto[] = [];

  // Submit
  submitting = false;
  submitError: string | null = null;

  get displayedTransactions(): TransactionDto[] {
    if (this.showOnlyMatches && this.simulationActive) {
      return this.matchingTransactionDtos;
    }
    return this.allTransactions;
  }

  ngOnInit(): void {
    this.loadTransactions(0);
    this.setupSimulationPipeline();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSimulationPipeline(): void {
    this.rulesChanged$.pipe(
      debounceTime(400),
      switchMap(() => {
        if (this.rules.length === 0) {
          this.simulationActive = false;
          this.matchingIds.clear();
          this.matchingTransactionDtos = [];
          this.overlappingPayments = [];
          this.cdr.markForCheck();
          return EMPTY;
        }

        this.simulating = true;
        this.cdr.markForCheck();

        const ruleRequests: CreateRuleRequest[] = this.rules.map(r => ({
          ruleType: r.ruleType as RuleType,
          targetField: r.targetField as TargetField | undefined,
          text: r.text,
          strict: r.strict,
          threshold: r.threshold,
          amount: r.amount,
          fluctuationRange: r.fluctuationRange,
        }));

        return this.recurringPaymentsService.simulateRules({ rules: ruleRequests });
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        this.simulationActive = true;
        this.simulating = false;
        this.matchingIds = new Set(result.matchingTransactions.map(t => t.id));
        this.matchingTransactionDtos = result.matchingTransactions;
        this.overlappingPayments = result.overlappingPayments;
        this.cdr.markForCheck();
      },
      error: () => {
        this.simulating = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadTransactions(page: number): void {
    this.loadingTransactions = true;
    this.currentPage = page;
    this.transactionsService.getTransactions(
      undefined, undefined, undefined, true, page, 20, 'bookingDate', 'desc'
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

  // Rule management

  saveRule(): void {
    this.ruleFormError = null;
    const isText = this.ruleFormType === 'JARO_WINKLER' || this.ruleFormType === 'REGEX';

    if (isText && (!this.ruleFormText || !this.ruleFormText.trim())) {
      this.ruleFormError = 'Text is required.';
      return;
    }
    if (this.ruleFormType === 'JARO_WINKLER' && (this.ruleFormThreshold < 0 || this.ruleFormThreshold > 1)) {
      this.ruleFormError = 'Threshold must be between 0 and 1.';
      return;
    }
    if (this.ruleFormType === 'AMOUNT' && this.ruleFormAmount == null) {
      this.ruleFormError = 'Amount is required.';
      return;
    }
    if (this.ruleFormType === 'AMOUNT' && (this.ruleFormFluctuationRange == null || this.ruleFormFluctuationRange < 0)) {
      this.ruleFormError = 'Fluctuation range must be non-negative.';
      return;
    }

    const rule: LocalRule = {
      id: this.editingRule?.id || crypto.randomUUID(),
      ruleType: this.ruleFormType,
      targetField: isText ? this.ruleFormTargetField : undefined,
      text: isText ? this.ruleFormText : undefined,
      strict: isText ? this.ruleFormStrict : undefined,
      threshold: this.ruleFormType === 'JARO_WINKLER' ? this.ruleFormThreshold : undefined,
      amount: this.ruleFormType === 'AMOUNT' ? this.ruleFormAmount! : undefined,
      fluctuationRange: this.ruleFormType === 'AMOUNT' ? this.ruleFormFluctuationRange! : undefined,
    };

    if (this.editingRule) {
      const idx = this.rules.findIndex(r => r.id === this.editingRule!.id);
      if (idx >= 0) this.rules[idx] = rule;
    } else {
      if (this.rules.length === 0) {
        this.showOnlyMatches = true;
      }
      this.rules = [...this.rules, rule];
    }

    this.editingRule = null;
    this.showRuleForm = false;
    this.resetRuleForm();
    this.rulesChanged$.next();
  }

  startEditRule(rule: LocalRule): void {
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

  cancelRuleForm(): void {
    this.editingRule = null;
    this.showRuleForm = false;
    this.resetRuleForm();
  }

  removeRule(rule: LocalRule): void {
    this.rules = this.rules.filter(r => r.id !== rule.id);
    if (this.editingRule?.id === rule.id) {
      this.editingRule = null;
      this.resetRuleForm();
    }
    this.rulesChanged$.next();
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

  formatRuleSummary(rule: LocalRule): string {
    switch (rule.ruleType) {
      case 'JARO_WINKLER':
        return `"${rule.text}" (threshold: ${rule.threshold})${rule.strict ? ' [strict]' : ''}`;
      case 'REGEX':
        return `/${rule.text}/${rule.strict ? ' [strict]' : ''}`;
      case 'AMOUNT':
        return `${this.currencyPipe.transform(rule.amount!)} +/- ${this.currencyPipe.transform(rule.fluctuationRange!)}`;
      default:
        return '';
    }
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
      rules: this.rules.map(r => ({
        ruleType: r.ruleType as RuleType,
        targetField: r.targetField as TargetField | undefined,
        text: r.text,
        strict: r.strict,
        threshold: r.threshold,
        amount: r.amount,
        fluctuationRange: r.fluctuationRange,
      }))
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

  private resetRuleForm(): void {
    this.ruleFormType = 'JARO_WINKLER';
    this.ruleFormTargetField = 'PARTNER_NAME';
    this.ruleFormText = '';
    this.ruleFormStrict = true;
    this.ruleFormThreshold = 0.85;
    this.ruleFormAmount = null;
    this.ruleFormFluctuationRange = null;
    this.ruleFormError = null;
  }
}
