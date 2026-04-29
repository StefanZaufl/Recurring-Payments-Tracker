import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, ModalComponent],
  template: `
    <app-modal
      [title]="title"
      size="sm"
      [scrollable]="false"
      (closeModal)="requestCancel()">
      <div class="px-5 py-4">
        <p class="text-sm text-muted">
          <ng-content></ng-content>
        </p>
      </div>
      <div footer class="flex gap-3 justify-end px-5 py-4 border-t border-card-border">
        <button
          type="button"
          (click)="requestCancel()"
          [disabled]="busy"
          class="text-sm text-muted hover:text-white transition-colors px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          (click)="confirmed.emit()"
          [disabled]="busy"
          class="text-sm transition-colors px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          [ngClass]="destructive
            ? 'bg-coral/20 text-coral hover:bg-coral/30'
            : 'bg-accent-dim text-accent hover:bg-accent/20'">
          {{ busy ? busyLabel : confirmLabel }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  @Input() title = 'Confirm';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() busyLabel = 'Working...';
  @Input() busy = false;
  @Input() destructive = true;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  requestCancel(): void {
    if (!this.busy) {
      this.cancelled.emit();
    }
  }
}
