import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TransactionDto } from '../../api/generated/model/transactionDto';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { TooltipComponent } from '../../shared/tooltip.component';
import { ToggleSwitchComponent } from '../../shared/toggle-switch.component';

@Component({
  selector: 'app-transaction-match-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyFormatPipe, TooltipComponent, ToggleSwitchComponent],
  template: `
    <div class="glass-card overflow-hidden">
      <div class="px-5 py-4 border-b border-card-border flex items-center justify-between gap-4">
        <div>
          <h2 class="text-sm font-semibold text-white">{{ title }}</h2>
          <p class="text-[11px] text-muted mt-0.5">{{ subtitle }}</p>
          @if (error) {
            <p class="text-[11px] text-coral mt-1">{{ error }}</p>
          }
        </div>
        <div class="flex items-center gap-3">
          @if (simulating) {
            <div class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
          }
          @if (showMatchesToggle) {
            <app-toggle-switch
              label="Matches only"
              size="sm"
              [checked]="showOnlyMatches"
              (checkedChange)="showOnlyMatchesChange.emit($event)" />
          }
        </div>
      </div>

      @if (loading) {
        <div class="py-16 text-center text-xs text-muted">Loading transactions...</div>
      } @else {
        <div class="divide-y divide-card-border">
          @for (tx of transactions; track tx.id) {
            <div class="px-5 py-3 flex items-center gap-4 transition-colors"
              [class.border-l-2]="isMatch(tx.id)"
              [class.border-l-accent]="isMatch(tx.id)"
              [class.bg-accent/5]="isMatch(tx.id)">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-medium text-white truncate">{{ tx.partnerName || 'Unknown' }}</span>
                  @if (isMatch(tx.id)) {
                    <span class="badge bg-accent-dim text-accent text-[10px]">{{ matchLabel }}</span>
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
            <div class="flex items-center gap-1">
              <button (click)="pageChange.emit(currentPage - 1)" [disabled]="currentPage === 0"
                class="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button (click)="pageChange.emit(currentPage + 1)" [disabled]="currentPage >= totalPages - 1"
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
  `,
})
export class TransactionMatchPreviewComponent {
  @Input() title = 'Transactions';
  @Input() subtitle = '';
  @Input() error: string | null = null;
  @Input() transactions: TransactionDto[] = [];
  @Input() matchingIds = new Set<string>();
  @Input() otherGroupMatches = new Map<string, string[]>();
  @Input() loading = false;
  @Input() simulating = false;
  @Input() simulationActive = false;
  @Input() showOnlyMatches = false;
  @Input() showMatchesToggle = false;
  @Input() matchLabel = 'match';
  @Input() currentPage = 0;
  @Input() totalPages = 0;
  @Output() showOnlyMatchesChange = new EventEmitter<boolean>();
  @Output() pageChange = new EventEmitter<number>();

  isMatch(transactionId: string): boolean {
    return this.matchingIds.has(transactionId);
  }

  otherGroupNames(transactionId: string): string[] {
    return this.otherGroupMatches.get(transactionId) ?? [];
  }

  visibleNames(names: string[]): string[] {
    return names.slice(0, 2);
  }

  hiddenNames(names: string[]): string[] {
    return names.slice(2);
  }

  linkBadge(tx: TransactionDto): string {
    const count = tx.linkedPaymentCount || 0;
    return count === 1 ? 'linked' : `${count} links`;
  }
}
