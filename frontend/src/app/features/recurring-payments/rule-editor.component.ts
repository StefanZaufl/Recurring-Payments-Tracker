import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';

export interface LocalRule {
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
  selector: 'app-rule-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="overflow-hidden"
      [class.glass-card]="framed">
      <div class="px-5 py-4 border-b border-card-border flex items-center justify-between">
        <h2 class="text-sm font-semibold text-white">{{ title }}</h2>
        <span class="badge bg-subtle text-muted text-[10px]">{{ rules.length }} rule{{ rules.length === 1 ? '' : 's' }}</span>
      </div>

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

      @if (showRuleForm || editingRule || rules.length === 0) {
        <div class="px-5 py-4 border-t border-card-border space-y-3">
          <p class="text-[11px] text-muted uppercase tracking-wider font-medium">
            {{ editingRule ? 'Edit rule' : 'Add rule' }}
          </p>

          @if (!editingRule) {
            <select [(ngModel)]="ruleFormType" (change)="ruleFormError = null"
              class="w-full text-xs bg-subtle border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/40">
              <option value="JARO_WINKLER">Jaro-Winkler (Fuzzy Text Match)</option>
              <option value="REGEX">Regex (Pattern Match)</option>
              <option value="AMOUNT">Amount (Value Range)</option>
            </select>
          }

          @if (isTextRule()) {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="rule-target-field" class="text-[11px] text-muted mb-1 block">Target Field</label>
                  <select id="rule-target-field" [(ngModel)]="ruleFormTargetField"
                    class="w-full text-xs bg-card border border-card-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent/40">
                    <option value="PARTNER_NAME">Partner Name</option>
                    <option value="ACCOUNT">Account</option>
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
  `
})
export class RuleEditorComponent {
  @Input() title = 'Detection Rules';
  @Input() rules: LocalRule[] = [];
  @Input() framed = true;
  @Output() rulesChange = new EventEmitter<LocalRule[]>();
  @Output() firstRuleAdded = new EventEmitter<void>();

  private readonly currencyPipe = new CurrencyFormatPipe();

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

  saveRule(): void {
    this.ruleFormError = null;
    const validationError = this.getRuleFormError();
    if (validationError) {
      this.ruleFormError = validationError;
      return;
    }

    const rule = this.buildRuleFromForm();

    if (!this.editingRule && this.hasDuplicateRules([...this.rules, rule])) {
      this.ruleFormError = 'Duplicate rules are not allowed.';
      return;
    }

    const wasEmpty = this.rules.length === 0;
    const nextRules = this.editingRule
      ? this.rules.map(existing => existing.id === this.editingRule?.id ? rule : existing)
      : [...this.rules, rule];

    if (this.rejectDuplicateRules(nextRules)) {
      this.ruleFormError = 'Duplicate rules are not allowed.';
      return;
    }

    this.editingRule = null;
    this.showRuleForm = false;
    this.resetRuleForm();
    this.rulesChange.emit(nextRules);
    if (wasEmpty) {
      this.firstRuleAdded.emit();
    }
  }

  private getRuleFormError(): string | null {
    if (this.isTextRule() && !this.ruleFormText.trim()) {
      return 'Text is required.';
    }
    if (this.ruleFormType === 'JARO_WINKLER' && (this.ruleFormThreshold < 0 || this.ruleFormThreshold > 1)) {
      return 'Threshold must be between 0 and 1.';
    }
    if (this.ruleFormType === 'AMOUNT' && this.ruleFormAmount == null) {
      return 'Amount is required.';
    }
    if (this.ruleFormType === 'AMOUNT' && (this.ruleFormFluctuationRange == null || this.ruleFormFluctuationRange < 0)) {
      return 'Fluctuation range must be non-negative.';
    }
    return null;
  }

  private buildRuleFromForm(): LocalRule {
    return {
      id: this.editingRule?.id || crypto.randomUUID(),
      ruleType: this.ruleFormType,
      targetField: this.isTextRule() ? this.ruleFormTargetField : undefined,
      text: this.isTextRule() ? this.ruleFormText.trim() : undefined,
      strict: this.isTextRule() ? this.ruleFormStrict : undefined,
      threshold: this.ruleFormType === 'JARO_WINKLER' ? this.ruleFormThreshold : undefined,
      amount: this.ruleFormType === 'AMOUNT' ? this.ruleFormAmount! : undefined,
      fluctuationRange: this.ruleFormType === 'AMOUNT' ? this.ruleFormFluctuationRange! : undefined,
    };
  }

  private rejectDuplicateRules(rules: LocalRule[]): boolean {
    return this.hasDuplicateRules(rules);
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
    const nextRules = this.rules.filter(existing => existing.id !== rule.id);
    if (this.editingRule?.id === rule.id) {
      this.editingRule = null;
      this.resetRuleForm();
    }
    this.rulesChange.emit(nextRules);
  }

  isTextRule(): boolean {
    return this.ruleFormType === 'JARO_WINKLER' || this.ruleFormType === 'REGEX';
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
      case 'ACCOUNT': return 'Account';
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

  private ruleKey(rule: LocalRule): string {
    if (rule.ruleType === 'AMOUNT') return `AMOUNT:${rule.amount}:${rule.fluctuationRange}`;
    return `${rule.ruleType}:${rule.targetField}:${(rule.text || '').trim().toLowerCase()}:${rule.strict !== false}:${rule.threshold || ''}`;
  }

  private hasDuplicateRules(rules: LocalRule[]): boolean {
    const keys = rules.map(rule => this.ruleKey(rule));
    return new Set(keys).size !== keys.length;
  }
}
