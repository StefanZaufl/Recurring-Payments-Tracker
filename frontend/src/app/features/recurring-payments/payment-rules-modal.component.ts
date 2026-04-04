import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecurringPaymentRulesService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { RuleDto } from '../../api/generated/model/ruleDto';
import { RuleType } from '../../api/generated/model/ruleType';
import { TargetField } from '../../api/generated/model/targetField';
import { CreateRuleRequest } from '../../api/generated/model/createRuleRequest';
import { ModalComponent } from '../../shared/modal.component';
import { CURRENCY_LOCALE, CURRENCY_CODE } from '../../shared/constants';
import { Subject, forkJoin, takeUntil } from 'rxjs';

@Component({
  selector: 'app-payment-rules-modal',
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <app-modal
      title="Detection Rules"
      [subtitle]="payment.name"
      size="md"
      (closeModal)="closed.emit()">
      <!-- Loading -->
      @if (loading) {
        <div class="flex flex-col items-center justify-center py-12 gap-3">
          <div class="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
          <span class="text-xs text-muted">Loading rules...</span>
        </div>
      }
      <!-- Error -->
      @if (!loading && error) {
        <div class="p-5">
          <p class="text-sm text-coral font-medium">{{ error }}</p>
        </div>
      }
      <!-- Rules list -->
      @if (!loading && !error) {
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
      <!-- Add/Edit rule form -->
      @if (!loading && !error) {
        <div footer class="px-5 py-4 border-t border-card-border shrink-0">
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
              [disabled]="saving"
              class="btn-primary text-xs px-4 py-2">
              {{ saving ? 'Saving...' : (editingRule ? 'Update Rule' : 'Add Rule') }}
            </button>
            @if (editingRule) {
              <button (click)="cancelEditRule()"
                class="text-xs text-muted hover:text-white transition-colors px-3 py-2">
                Cancel
              </button>
            }
            @if (formError) {
              <span class="text-xs text-coral ml-2">{{ formError }}</span>
            }
          </div>
        </div>
      }
    </app-modal>
  `
})
export class PaymentRulesModalComponent implements OnInit, OnDestroy {
  private rulesService = inject(RecurringPaymentRulesService);
  private destroy$ = new Subject<void>();

  @Input({ required: true }) payment!: RecurringPaymentDto;
  @Output() closed = new EventEmitter<void>();
  @Output() paymentUpdated = new EventEmitter<{ payment: RecurringPaymentDto; ruleCount: number }>();

  rules: RuleDto[] = [];
  loading = false;
  error: string | null = null;
  editingRule: RuleDto | null = null;
  saving = false;
  formError: string | null = null;

  // Rule form fields
  ruleFormType = 'JARO_WINKLER';
  ruleFormTargetField = 'PARTNER_NAME';
  ruleFormText = '';
  ruleFormStrict = true;
  ruleFormThreshold = 0.85;
  ruleFormAmount: number | null = null;
  ruleFormFluctuationRange: number | null = null;

  ngOnInit(): void {
    this.loadRules();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRules(): void {
    this.loading = true;
    this.error = null;
    this.rules = [];
    this.editingRule = null;
    this.resetRuleForm();

    this.rulesService.getRules(this.payment.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (rules) => {
        this.rules = rules;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load rules.';
        this.loading = false;
      }
    });
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
    this.formError = null;
  }

  cancelEditRule(): void {
    this.editingRule = null;
    this.resetRuleForm();
  }

  onRuleTypeChange(): void {
    this.formError = null;
  }

  saveRule(): void {
    this.saving = true;
    this.formError = null;

    if (this.editingRule) {
      this.rulesService.updateRule(this.payment.id, this.editingRule.id, {
        targetField: this.isTextRule() ? this.ruleFormTargetField as TargetField : undefined,
        text: this.isTextRule() ? this.ruleFormText : undefined,
        strict: this.isTextRule() ? this.ruleFormStrict : undefined,
        threshold: this.ruleFormType === 'JARO_WINKLER' ? this.ruleFormThreshold : undefined,
        amount: this.ruleFormType === 'AMOUNT' ? this.ruleFormAmount! : undefined,
        fluctuationRange: this.ruleFormType === 'AMOUNT' ? this.ruleFormFluctuationRange! : undefined,
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => this.onRuleSaved(),
        error: (err) => {
          this.formError = err.error?.message || 'Failed to update rule.';
          this.saving = false;
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

      this.rulesService.createRule(this.payment.id, request).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => this.onRuleSaved(),
        error: (err) => {
          this.formError = err.error?.message || 'Failed to create rule.';
          this.saving = false;
        }
      });
    }
  }

  deleteRule(rule: RuleDto): void {
    this.rulesService.deleteRule(this.payment.id, rule.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.onRuleSaved(),
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete rule.';
      }
    });
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

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: CURRENCY_CODE }).format(value);
  }

  private onRuleSaved(): void {
    const paymentId = this.payment.id;

    forkJoin({
      updatedPayment: this.rulesService.reEvaluateRecurringPayment(paymentId),
      rules: this.rulesService.getRules(paymentId)
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ updatedPayment, rules }) => {
        this.rules = rules;
        this.paymentUpdated.emit({ payment: updatedPayment, ruleCount: rules.length });
      }
    });

    this.editingRule = null;
    this.resetRuleForm();
    this.saving = false;
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
    this.formError = null;
    this.saving = false;
  }
}
