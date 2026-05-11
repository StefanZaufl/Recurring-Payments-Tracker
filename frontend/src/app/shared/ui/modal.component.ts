import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="button"
      tabindex="0"
      [attr.aria-label]="'Close ' + title"
      (click)="closeModal.emit()"
      (keydown.enter)="closeModal.emit()"
      (keydown.escape)="closeModal.emit()">
      <div
        class="glass-card w-full p-0 animate-slide-up border-subtle flex flex-col"
        [class.max-w-sm]="size === 'sm'"
        [class.max-w-2xl]="size === 'md'"
        [class.max-w-3xl]="size === 'lg'"
        [class.max-h-[85vh]]="scrollable"
        role="dialog"
        tabindex="-1"
        (click)="$event.stopPropagation()"
        (keydown.enter)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-card-border shrink-0">
          <div class="min-w-0 flex-1">
            <h3 class="text-sm font-semibold text-white">{{ title }}</h3>
            @if (subtitle) {
              <div class="flex items-center gap-2 mt-0.5">
                <p class="text-xs text-muted truncate">{{ subtitle }}</p>
                <ng-content select="[subtitle-extra]"></ng-content>
              </div>
            }
          </div>
          <button (click)="closeModal.emit()" aria-label="Close"
            class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors shrink-0 ml-3">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <!-- Toolbar slot (between header and content) -->
        <ng-content select="[toolbar]"></ng-content>
        <!-- Content area -->
        <div [class.overflow-y-auto]="scrollable" [class.flex-1]="scrollable" [class.min-h-0]="scrollable">
          <ng-content></ng-content>
        </div>
        <!-- Footer slot -->
        <ng-content select="[footer]"></ng-content>
      </div>
    </div>
  `
})
export class ModalComponent {
  @Input() title = '';
  @Input() subtitle: string | null = null;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() scrollable = true;
  @Output() closeModal = new EventEmitter<void>();
}
