import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-20 gap-3">
      <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
      <span class="text-sm text-muted">{{ message }}</span>
    </div>
  `
})
export class LoadingSpinnerComponent {
  @Input() message = 'Loading...';
}
