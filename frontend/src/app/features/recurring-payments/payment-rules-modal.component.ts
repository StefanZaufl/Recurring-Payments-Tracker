import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecurringPaymentRulesService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { RuleDto } from '../../api/generated/model/ruleDto';
import { RuleType } from '../../api/generated/model/ruleType';
import { TargetField } from '../../api/generated/model/targetField';
import { CreateRuleRequest } from '../../api/generated/model/createRuleRequest';
import { ModalComponent } from '../../shared/modal.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner.component';
import { LocalRule, RuleEditorComponent } from './rule-editor.component';
import { Subject, forkJoin, takeUntil } from 'rxjs';

@Component({
  selector: 'app-payment-rules-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ModalComponent, LoadingSpinnerComponent, RuleEditorComponent],
  template: `
    <app-modal
      title="Detection Rules"
      [subtitle]="payment.name"
      size="md"
      (closeModal)="closed.emit()">
      <!-- Loading -->
      @if (loading) {
        <app-loading-spinner message="Loading rules..." />
      }
      <!-- Error -->
      @if (!loading && error) {
        <div class="p-5">
          <p class="text-sm text-coral font-medium">{{ error }}</p>
        </div>
      }
      <!-- Rules list -->
      @if (!loading && !error) {
        <div class="p-5">
          @if (formError) {
            <p class="text-xs text-coral mb-3">{{ formError }}</p>
          }
          <app-rule-editor
            title="Detection Rules"
            [framed]="false"
            [rules]="rules"
            (rulesChange)="onRulesChange($event)" />
        </div>
      }
    </app-modal>
  `
})
export class PaymentRulesModalComponent implements OnInit, OnDestroy {
  private readonly rulesService = inject(RecurringPaymentRulesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) payment!: RecurringPaymentDto;
  @Output() closed = new EventEmitter<void>();
  @Output() paymentUpdated = new EventEmitter<{ payment: RecurringPaymentDto; ruleCount: number }>();

  rules: RuleDto[] = [];
  loading = false;
  error: string | null = null;
  formError: string | null = null;

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
    this.formError = null;

    this.rulesService.getRules(this.payment.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (rules) => {
        this.rules = rules;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load rules.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onRulesChange(nextRules: LocalRule[]): void {
    this.formError = null;

    const deletedRule = this.rules.find((rule) => !nextRules.some((nextRule) => nextRule.id === rule.id));
    if (deletedRule) {
      this.deleteRule(deletedRule);
      return;
    }

    const addedRule = nextRules.find((rule) => !this.rules.some((existingRule) => existingRule.id === rule.id));
    if (addedRule) {
      this.createRule(addedRule);
      return;
    }

    const updatedRule = nextRules.find((rule) => {
      const currentRule = this.rules.find((existingRule) => existingRule.id === rule.id);
      return currentRule && this.rulePayloadChanged(currentRule, rule);
    });
    if (updatedRule) {
      this.updateRule(updatedRule);
    }
  }

  private createRule(rule: LocalRule): void {
    this.rulesService.createRule(this.payment.id, this.toCreateRuleRequest(rule)).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.onRuleSaved(),
      error: (err) => {
        this.formError = err.error?.message || 'Failed to create rule.';
        this.cdr.markForCheck();
      }
    });
  }

  private updateRule(rule: LocalRule): void {
    this.rulesService.updateRule(this.payment.id, rule.id, this.toCreateRuleRequest(rule)).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.onRuleSaved(),
      error: (err) => {
        this.formError = err.error?.message || 'Failed to update rule.';
        this.cdr.markForCheck();
      }
    });
  }

  private deleteRule(rule: RuleDto): void {
    this.rulesService.deleteRule(this.payment.id, rule.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.onRuleSaved(),
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete rule.';
        this.cdr.markForCheck();
      }
    });
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
        this.formError = null;
        this.cdr.markForCheck();
      }
    });
  }

  private toCreateRuleRequest(rule: LocalRule): CreateRuleRequest {
    return {
      ruleType: rule.ruleType as RuleType,
      targetField: this.isTextRule(rule) ? rule.targetField as TargetField : undefined,
      text: this.isTextRule(rule) ? rule.text : undefined,
      strict: this.isTextRule(rule) ? rule.strict : undefined,
      threshold: rule.ruleType === 'JARO_WINKLER' ? rule.threshold : undefined,
      amount: rule.ruleType === 'AMOUNT' ? rule.amount : undefined,
      fluctuationRange: rule.ruleType === 'AMOUNT' ? rule.fluctuationRange : undefined,
    };
  }

  private isTextRule(rule: LocalRule): boolean {
    return rule.ruleType === 'JARO_WINKLER' || rule.ruleType === 'REGEX';
  }

  private rulePayloadChanged(currentRule: RuleDto, nextRule: LocalRule): boolean {
    return JSON.stringify(this.toCreateRuleRequest(currentRule)) !== JSON.stringify(this.toCreateRuleRequest(nextRule));
  }
}
