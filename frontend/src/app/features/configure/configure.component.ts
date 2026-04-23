import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild, inject } from '@angular/core';
import { RecurringPaymentsService } from '../../api/generated';
import { RecalculationSummaryResponse } from '../../api/generated/model/recalculationSummaryResponse';
import { ConfigureBankAccountsSectionComponent } from './configure-bank-accounts-section.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

import { ConfigureCategoriesSectionComponent } from './configure-categories-section.component';

@Component({
  selector: 'app-configure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfigureCategoriesSectionComponent, ConfigureBankAccountsSectionComponent, ConfirmDialogComponent],
  template: `
    <div class="animate-fade-in min-w-0 overflow-hidden">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Configure</h1>
        <p class="text-sm text-muted mt-0.5">Manage categories and bank accounts</p>
      </div>

      @if (summary) {
        <div class="mb-6 rounded-2xl border border-accent/20 bg-accent-dim px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-white">Latest Recalculation</p>
              <p class="text-xs text-muted mt-0.5">Inter-account and recurring-payment state has been refreshed.</p>
            </div>
            <button type="button"
              (click)="summary = null"
              class="text-xs text-muted hover:text-white transition-colors">
              Dismiss
            </button>
          </div>
          <div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-xl bg-surface/70 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted">Transactions Marked Inter-Account</p>
              <p class="mt-1 text-lg font-semibold text-white">{{ summary.transactionsMarkedInterAccount }}</p>
            </div>
            <div class="rounded-xl bg-surface/70 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted">Transaction Links Removed</p>
              <p class="mt-1 text-lg font-semibold text-white">{{ summary.transactionLinksRemoved }}</p>
            </div>
            <div class="rounded-xl bg-surface/70 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted">Recurring Payments Deleted</p>
              <p class="mt-1 text-lg font-semibold text-white">{{ summary.recurringPaymentsDeleted }}</p>
            </div>
            <div class="rounded-xl bg-surface/70 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted">Recurring Payments Detected</p>
              <p class="mt-1 text-lg font-semibold text-white">{{ summary.recurringPaymentsDetected }}</p>
            </div>
          </div>
        </div>
      }

      @if (error) {
        <div class="mb-6 rounded-2xl border border-coral/20 bg-coral-dim px-4 py-3 text-sm text-coral">
          {{ error }}
        </div>
      }

      <div class="grid gap-6 lg:gap-8">
        <app-configure-categories-section />
        <app-configure-bank-accounts-section
          [actionsDisabled]="recalculationBusy"
          (recalculationBusyChange)="onRecalculationBusyChange($event)"
          (recalculationSummaryChange)="onRecalculationSummaryChange($event)" />
        <section>
          <div class="flex items-center gap-2 mb-4">
            <div class="w-7 h-7 rounded-lg bg-coral-dim flex items-center justify-center shrink-0">
              <svg class="w-3.5 h-3.5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 7.5h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-semibold text-white">Danger Zone</h2>
              <span class="group relative inline-flex">
                <button type="button"
                  class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-card-border text-[11px] text-muted hover:text-white transition-colors"
                  aria-label="What does recalculation do?">
                  ?
                </button>
                <span class="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-72 -translate-x-1/2 rounded-xl border border-card-border bg-surface px-3 py-2 text-xs text-muted shadow-lg group-hover:block group-focus-within:block">
                  Recalculates inter-account transfers and recurring payments for all your transactions. This can remove recurring payments that no longer have matching transactions.
                </span>
              </span>
            </div>
          </div>
          <div class="glass-card border border-coral/20 p-5">
            <p class="text-sm text-muted">
              Rebuild recurring-payment links after bank-account ownership changes or to repair older imported data.
            </p>
            <div class="mt-4 flex items-center gap-3">
              <button type="button"
                (click)="showConfirmation = true"
                [disabled]="recalculationBusy"
                class="inline-flex items-center justify-center rounded-xl bg-coral/15 px-4 py-2.5 text-sm font-medium text-coral transition-colors hover:bg-coral/25 disabled:cursor-not-allowed disabled:opacity-40">
                @if (!recalculationBusy) {
                  Recalculate Now
                } @else {
                  <span class="inline-flex items-center gap-2">
                    <span class="h-4 w-4 rounded-full border-2 border-coral/30 border-t-coral animate-spin"></span>
                    Recalculating...
                  </span>
                }
              </button>
            </div>
          </div>
        </section>
      </div>

      @if (showConfirmation) {
        <app-confirm-dialog
          title="Recalculate Recurring Payments"
          confirmLabel="Confirm"
          busyLabel="Recalculating..."
          [busy]="recalculationBusy"
          (confirmed)="runRecalculation()"
          (cancelled)="closeConfirmation()">
          This will recalculate inter-account transfers and recurring payments for all your transactions. Recurring payments without matching transactions will be removed.
        </app-confirm-dialog>
      }
    </div>
  `
})
export class ConfigureComponent {
  private readonly recurringPaymentsService = inject(RecurringPaymentsService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild(ConfigureBankAccountsSectionComponent)
  private bankAccountsSection?: ConfigureBankAccountsSectionComponent;

  recalculationBusy = false;
  showConfirmation = false;
  summary: RecalculationSummaryResponse | null = null;
  error: string | null = null;

  onRecalculationBusyChange(isBusy: boolean): void {
    this.recalculationBusy = isBusy;
    this.cdr.markForCheck();
  }

  onRecalculationSummaryChange(summary: RecalculationSummaryResponse): void {
    this.summary = summary;
    this.error = null;
    this.recalculationBusy = false;
    this.cdr.markForCheck();
  }

  closeConfirmation(): void {
    if (this.recalculationBusy) {
      return;
    }
    this.showConfirmation = false;
  }

  runRecalculation(): void {
    if (this.recalculationBusy) {
      return;
    }

    this.recalculationBusy = true;
    this.error = null;
    this.recurringPaymentsService.recalculateRecurringPayments().subscribe({
      next: (summary) => {
        this.summary = summary;
        this.recalculationBusy = false;
        this.showConfirmation = false;
        this.bankAccountsSection?.loadBankAccounts();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to recalculate recurring payments.';
        this.recalculationBusy = false;
        this.showConfirmation = false;
        this.cdr.markForCheck();
      }
    });
  }
}
