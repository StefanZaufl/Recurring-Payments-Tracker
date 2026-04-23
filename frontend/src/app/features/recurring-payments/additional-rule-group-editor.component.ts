import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap, takeUntil, EMPTY } from 'rxjs';
import { AdditionalRuleGroupsService, RecurringPaymentsService, TransactionsService } from '../../api/generated';
import { AdditionalRuleGroupDto } from '../../api/generated/model/additionalRuleGroupDto';
import { AdditionalGroupTransactionMatchDto } from '../../api/generated/model/additionalGroupTransactionMatchDto';
import { CreateRuleRequest } from '../../api/generated/model/createRuleRequest';
import { RuleDto } from '../../api/generated/model/ruleDto';
import { RuleType } from '../../api/generated/model/ruleType';
import { TargetField } from '../../api/generated/model/targetField';
import { TransactionDto } from '../../api/generated/model/transactionDto';
import { SimulationDraftType } from '../../api/generated/model/simulationDraftType';
import { RecalculationSummaryResponse } from '../../api/generated/model/recalculationSummaryResponse';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { formatLocalDate } from '../../shared/date-range-presets';
import { TooltipComponent } from '../../shared/tooltip.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { LocalRule, RuleEditorComponent } from './rule-editor.component';

@Component({
  selector: 'app-additional-rule-group-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyFormatPipe, TooltipComponent, ConfirmDialogComponent, RuleEditorComponent],
  template: `
    <div class="animate-fade-in">
      <div class="flex items-center gap-4 mb-6">
        <a routerLink="/recurring-payments" [queryParams]="{ tab: 'ADDITIONAL' }"
          class="w-8 h-8 flex items-center justify-center rounded-lg bg-subtle text-muted hover:text-white hover:bg-card-hover transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        </a>
        <div class="flex-1">
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">{{ isNew ? 'Create Additional Rule Group' : 'Edit Additional Rule Group' }}</h1>
          <p class="text-sm text-muted mt-0.5">All rules in this group must match for a transaction to be excluded. Counts use transactions from the last 2 years.</p>
        </div>
      </div>

      @if (loading) {
        <div class="glass-card p-8 text-sm text-muted">Loading rule group...</div>
      } @else if (loadError) {
        <div class="glass-card p-8 text-sm text-coral">{{ loadError }}</div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div class="lg:col-span-3 glass-card overflow-hidden">
            <div class="px-5 py-4 border-b border-card-border flex items-center justify-between gap-4">
              <div>
                @if (simulationActive) {
                  <h2 class="text-sm font-semibold text-white">
                    <span class="text-accent">{{ totalMatchCount }}</span> total matches
                  </h2>
                  <p class="text-[11px] text-muted mt-0.5">{{ uniqueExclusionCount }} unique exclusions of {{ totalTransactions }} non-inter-account transactions</p>
                } @else {
                  <h2 class="text-sm font-semibold text-white">Transactions</h2>
                  <p class="text-[11px] text-muted mt-0.5">Showing non-inter-account transactions from the last 2 years</p>
                }
                @if (simulationError) {
                  <p class="text-[11px] text-coral mt-1">{{ simulationError }}</p>
                }
              </div>
              <div class="flex items-center gap-3">
                @if (simulating) {
                  <div class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                }
                @if (simulationActive) {
                  <label class="flex items-center gap-2 text-[11px] text-muted cursor-pointer select-none">
                    <div class="relative">
                      <input type="checkbox" [(ngModel)]="showOnlyMatches" class="sr-only peer">
                      <div class="w-7 h-[16px] bg-subtle rounded-full peer-checked:bg-accent/30 transition-colors"></div>
                      <div class="absolute top-[2px] left-[2px] w-3 h-3 bg-muted rounded-full peer-checked:translate-x-3 peer-checked:bg-accent transition-all"></div>
                    </div>
                    Matches only
                  </label>
                }
              </div>
            </div>
            @if (loadingTransactions) {
              <div class="py-16 text-center text-xs text-muted">Loading transactions...</div>
            } @else {
              <div class="divide-y divide-card-border">
                @for (tx of displayedTransactions; track tx.id) {
                  <div class="px-5 py-3 flex items-center gap-4 transition-colors"
                    [class.border-l-2]="isCurrentMatch(tx.id)"
                    [class.border-l-accent]="isCurrentMatch(tx.id)"
                    [class.bg-accent]="false"
                    [class.bg-accent/5]="isCurrentMatch(tx.id)">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-medium text-white truncate">{{ tx.partnerName || 'Unknown' }}</span>
                        @if (isCurrentMatch(tx.id)) {
                          <span class="badge bg-accent-dim text-accent text-[10px]">excluded</span>
                        }
                        @if (otherGroupNames(tx.id).length > 0) {
                          <span class="badge bg-amber-dim text-amber text-[10px]">already excluded</span>
                          @for (name of visibleNames(otherGroupNames(tx.id)); track name) {
                            <span class="badge bg-subtle text-muted text-[10px]">{{ name }}</span>
                          }
                          @if (hiddenNames(otherGroupNames(tx.id)).length > 0) {
                            <app-tooltip>
                              <span tooltip-trigger class="badge bg-subtle text-muted text-[10px]">+{{ hiddenNames(otherGroupNames(tx.id)).length }} more</span>
                              <div class="space-y-1">
                                @for (name of hiddenNames(otherGroupNames(tx.id)); track name) {
                                  <div>{{ name }}</div>
                                }
                              </div>
                            </app-tooltip>
                          }
                        }
                        @if ((tx.linkedPaymentCount || 0) > 0) {
                          <app-tooltip>
                            <span tooltip-trigger class="badge bg-sky-dim text-sky text-[10px]">{{ linkBadge(tx) }}</span>
                            <div class="space-y-1">
                              @for (name of tx.linkedPaymentNames || []; track name) {
                                <div>{{ name }}</div>
                              }
                            </div>
                          </app-tooltip>
                        }
                      </div>
                      <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[11px] text-muted">{{ tx.bookingDate }}</span>
                        @if (tx.details) {
                          <span class="text-[11px] text-muted/60 truncate max-w-[260px]">{{ tx.details }}</span>
                        }
                      </div>
                    </div>
                    <span class="font-mono text-xs font-medium shrink-0" [class.text-accent]="tx.amount >= 0" [class.text-coral]="tx.amount < 0">
                      {{ tx.amount | appCurrency:true }}
                    </span>
                  </div>
                } @empty {
                  <div class="py-12 text-center text-sm text-muted">No transactions to display.</div>
                }
              </div>
              @if (totalPages > 1 && !(showOnlyMatches && simulationActive)) {
                <div class="px-5 py-3 border-t border-card-border flex items-center justify-between">
                  <span class="text-[11px] text-muted">Page {{ currentPage + 1 }} of {{ totalPages }}</span>
                  <div class="flex gap-2">
                    <button (click)="goToPage(currentPage - 1)" [disabled]="currentPage === 0" class="text-xs text-muted hover:text-white disabled:opacity-30">Previous</button>
                    <button (click)="goToPage(currentPage + 1)" [disabled]="currentPage >= totalPages - 1" class="text-xs text-muted hover:text-white disabled:opacity-30">Next</button>
                  </div>
                </div>
              }
            }
          </div>

          <div class="lg:col-span-2 space-y-6">
            <div class="glass-card p-5 space-y-4">
              <h2 class="text-sm font-semibold text-white">Group Details</h2>
              <div>
                <label for="additional-rule-group-name" class="text-[11px] text-muted mb-1 block uppercase tracking-wider font-medium">Name</label>
                <input id="additional-rule-group-name" [(ngModel)]="groupName" (ngModelChange)="onNameChange()"
                  class="w-full text-sm bg-subtle border border-card-border rounded-xl px-4 py-2.5 text-white placeholder-muted/50 focus:outline-none focus:border-accent/40 transition-colors"
                  placeholder="e.g. Amazon false positives">
                @if (nameError) {
                  <p class="text-xs text-coral mt-1">{{ nameError }}</p>
                }
              </div>
              @if (successMessage) {
                <p class="text-xs text-accent">{{ successMessage }}</p>
              }
              @if (saveError) {
                <p class="text-xs text-coral">{{ saveError }}</p>
              }
              <div class="flex items-center gap-3">
                <button (click)="save()" [disabled]="!canSave() || saving" class="btn-primary text-xs px-4 py-2 disabled:opacity-40">{{ saving ? 'Saving...' : 'Save' }}</button>
                <button (click)="deleteOrDiscard()" class="text-xs text-muted hover:text-coral">{{ isNew ? 'Discard' : 'Delete' }}</button>
              </div>
            </div>

            <app-rule-editor
              title="Rules"
              [rules]="rules"
              (rulesChange)="onRulesChange($event)" />
          </div>
        </div>
      }

      @if (showDeleteConfirmation) {
        <app-confirm-dialog
          title="Delete Additional Rule Group"
          confirmLabel="Delete"
          busyLabel="Deleting..."
          [busy]="deleting"
          (confirmed)="executeDelete()"
          (cancelled)="closeDeleteConfirmation()">
          This will delete <strong class="text-white">{{ groupName }}</strong> and recalculate recurring payments. Transactions excluded only by this group may become eligible again.
        </app-confirm-dialog>
      }
    </div>
  `
})
export class AdditionalRuleGroupEditorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groupsService = inject(AdditionalRuleGroupsService);
  private readonly transactionsService = inject(TransactionsService);
  private readonly recurringPaymentsService = inject(RecurringPaymentsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly rulesChanged$ = new Subject<void>();

  isNew = false;
  groupId: string | null = null;
  existingGroups: AdditionalRuleGroupDto[] = [];
  originalName = '';
  originalRulesJson = '';
  groupName = '';
  rules: LocalRule[] = [];
  loading = true;
  loadError: string | null = null;
  saving = false;
  saveError: string | null = null;
  successMessage: string | null = null;
  nameError: string | null = null;
  showDeleteConfirmation = false;
  deleting = false;

  allTransactions: TransactionDto[] = [];
  matchingTransactions: TransactionDto[] = [];
  matchingIds = new Set<string>();
  otherGroupMatches = new Map<string, string[]>();
  loadingTransactions = false;
  totalTransactions = 0;
  totalPages = 0;
  currentPage = 0;
  showOnlyMatches = false;
  simulationActive = false;
  simulating = false;
  simulationError: string | null = null;
  totalMatchCount = 0;
  uniqueExclusionCount = 0;

  get displayedTransactions(): TransactionDto[] {
    return this.showOnlyMatches && this.simulationActive ? this.matchingTransactions : this.allTransactions;
  }

  ngOnInit(): void {
    this.setupSimulation();
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.groupId = params.get('group');
      this.isNew = params.get('new') === 'true';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.groupsService.getAdditionalRuleGroups().pipe(takeUntil(this.destroy$)).subscribe({
      next: groups => {
        this.existingGroups = groups;
        if (this.groupId) {
          this.groupsService.getAdditionalRuleGroup(this.groupId).pipe(takeUntil(this.destroy$)).subscribe({
            next: group => this.applyGroup(group),
            error: err => this.failLoad(err.error?.message || 'Failed to load group.')
          });
        } else {
          this.isNew = true;
          this.applyDraft();
        }
      },
      error: err => this.failLoad(err.error?.message || 'Failed to load groups.')
    });
  }

  private applyGroup(group: AdditionalRuleGroupDto): void {
    this.groupName = group.name;
    this.originalName = group.name;
    this.rules = group.rules.map(rule => this.fromRuleDto(rule));
    this.originalRulesJson = this.rulesFingerprint();
    this.loading = false;
    this.loadTransactions(0);
    this.rulesChanged$.next();
    this.cdr.markForCheck();
  }

  private applyDraft(): void {
    this.groupName = '';
    this.originalName = '';
    this.rules = [];
    this.originalRulesJson = this.rulesFingerprint();
    this.loading = false;
    this.loadTransactions(0);
    this.cdr.markForCheck();
  }

  private failLoad(message: string): void {
    this.loadError = message;
    this.loading = false;
    this.cdr.markForCheck();
  }

  private setupSimulation(): void {
    this.rulesChanged$.pipe(
      debounceTime(400),
      switchMap(() => {
        if (this.rules.length === 0) {
          this.clearSimulation();
          return EMPTY;
        }
        this.simulating = true;
        this.simulationError = null;
        this.cdr.markForCheck();
        return this.recurringPaymentsService.simulateRules({
          draftType: SimulationDraftType.AdditionalGroup,
          currentAdditionalGroupId: this.groupId || undefined,
          rules: this.toRuleRequests()
        });
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: result => {
        this.simulationActive = true;
        this.simulating = false;
        this.matchingTransactions = result.matchingTransactions;
        this.matchingIds = new Set(result.matchingTransactions.map(tx => tx.id));
        this.totalMatchCount = result.totalMatchCount;
        this.uniqueExclusionCount = result.uniqueExclusionCount || 0;
        this.otherGroupMatches = this.toGroupMatchMap(result.otherAdditionalGroupMatches || []);
        this.cdr.markForCheck();
      },
      error: () => {
        this.simulating = false;
        this.simulationError = 'Simulation failed. Showing the last successful result.';
        this.cdr.markForCheck();
      }
    });
  }

  loadTransactions(page: number): void {
    this.loadingTransactions = true;
    this.currentPage = page;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 730);
    this.transactionsService.getTransactions(formatLocalDate(cutoff), undefined, undefined, undefined, 'NON_INTER_ACCOUNT', page, 20, 'bookingDate', 'desc')
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: result => {
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
    if (page >= 0 && page < this.totalPages) this.loadTransactions(page);
  }

  onNameChange(): void {
    this.validateName();
  }

  canSave(): boolean {
    this.validateName();
    return !this.nameError && this.rules.length > 0 && this.isDirty();
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving = true;
    this.saveError = null;
    const request = { name: this.groupName.trim(), rules: this.toRuleRequests() };
    const save$ = this.isNew
      ? this.groupsService.createAdditionalRuleGroup(request)
      : this.groupsService.updateAdditionalRuleGroup(this.groupId!, request);
    save$.pipe(takeUntil(this.destroy$)).subscribe({
      next: response => {
        this.saving = false;
        this.isNew = false;
        this.groupId = response.group.id;
        this.applyGroup(response.group);
        this.successMessage = response.recalculationSummary
          ? `Group saved. Recalculation: ${this.formatSummary(response.recalculationSummary)}.`
          : 'Group saved.';
        this.router.navigate(['/recurring-payments/additional'], { queryParams: { group: response.group.id }, replaceUrl: true });
      },
      error: err => {
        this.saving = false;
        if (err.status === 409) {
          this.nameError = err.error?.message || 'A group with this name already exists.';
        } else {
          this.saveError = err.error?.message || 'Failed to save group.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  deleteOrDiscard(): void {
    if (this.isNew) {
      if (!this.isDirty() || confirm('Discard this draft?')) {
        this.router.navigate(['/recurring-payments'], { queryParams: { tab: 'ADDITIONAL' } });
      }
      return;
    }
    this.showDeleteConfirmation = true;
  }

  closeDeleteConfirmation(): void {
    if (this.deleting) {
      return;
    }
    this.showDeleteConfirmation = false;
  }

  executeDelete(): void {
    if (!this.groupId || this.deleting) {
      return;
    }
    this.deleting = true;
    this.groupsService.deleteAdditionalRuleGroup(this.groupId!).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteConfirmation = false;
        this.router.navigate(['/recurring-payments'], { queryParams: { tab: 'ADDITIONAL' } });
      },
      error: err => {
        this.deleting = false;
        this.showDeleteConfirmation = false;
        this.saveError = err.error?.message || 'Failed to delete group.';
        this.cdr.markForCheck();
      }
    });
  }

  onRulesChange(rules: LocalRule[]): void {
    this.rules = rules;
    this.rulesChanged$.next();
  }

  isCurrentMatch(id: string): boolean {
    return this.matchingIds.has(id);
  }

  otherGroupNames(id: string): string[] {
    return this.otherGroupMatches.get(id) || [];
  }

  visibleNames(names: string[]): string[] {
    return names.slice(0, 3);
  }

  hiddenNames(names: string[]): string[] {
    return names.slice(3);
  }

  linkBadge(tx: TransactionDto): string {
    const count = tx.linkedPaymentCount || 0;
    return count === 1 ? '1 Link' : `${count} Links`;
  }

  private fromRuleDto(rule: RuleDto): LocalRule {
    return {
      id: rule.id,
      ruleType: rule.ruleType,
      targetField: rule.targetField,
      text: rule.text,
      strict: rule.strict,
      threshold: rule.threshold,
      amount: rule.amount,
      fluctuationRange: rule.fluctuationRange
    };
  }

  private toRuleRequests(): CreateRuleRequest[] {
    return this.rules.map(rule => ({
      ruleType: rule.ruleType as RuleType,
      targetField: rule.targetField as TargetField | undefined,
      text: rule.text,
      strict: rule.strict,
      threshold: rule.threshold,
      amount: rule.amount,
      fluctuationRange: rule.fluctuationRange
    }));
  }

  private toGroupMatchMap(matches: AdditionalGroupTransactionMatchDto[]): Map<string, string[]> {
    return new Map(matches.map(match => [match.transactionId, match.groups.map(group => group.name)]));
  }

  private clearSimulation(): void {
    this.simulationActive = false;
    this.matchingTransactions = [];
    this.matchingIds.clear();
    this.otherGroupMatches.clear();
    this.totalMatchCount = 0;
    this.uniqueExclusionCount = 0;
  }

  private validateName(): void {
    const normalized = this.normalizeName(this.groupName);
    if (!normalized) {
      this.nameError = 'Name is required.';
      return;
    }
    if (this.groupName.trim().length > 120) {
      this.nameError = 'Name must be at most 120 characters.';
      return;
    }
    const duplicate = this.existingGroups.some(group => group.id !== this.groupId && group.normalizedName === normalized);
    this.nameError = duplicate ? 'A group with this name already exists.' : null;
  }

  private normalizeName(name: string): string {
    return name.trim().replaceAll(/\s+/g, ' ').toLowerCase();
  }

  private isDirty(): boolean {
    return this.groupName.trim() !== this.originalName || this.rulesFingerprint() !== this.originalRulesJson;
  }

  private rulesFingerprint(): string {
    return JSON.stringify(this.toRuleRequests());
  }

  private formatSummary(summary: RecalculationSummaryResponse): string {
    return `${summary.transactionsMarkedInterAccount} inter-account marked, ${summary.transactionLinksRemoved} links removed, ${summary.recurringPaymentsDeleted} payments deleted, ${summary.recurringPaymentsDetected} payments detected`;
  }
}
