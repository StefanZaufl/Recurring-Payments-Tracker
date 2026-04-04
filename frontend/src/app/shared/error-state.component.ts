import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  template: `
    <div class="glass-card p-6 border-coral/20 animate-slide-up">
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-coral-dim flex items-center justify-center shrink-0 mt-0.5">
          <svg class="w-4 h-4 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p class="text-sm text-coral font-medium">{{ message }}</p>
          <button (click)="retry.emit()" class="mt-2 text-xs text-muted hover:text-white transition-colors">Try again</button>
        </div>
      </div>
    </div>
  `
})
export class ErrorStateComponent {
  @Input() message = '';
  @Output() retry = new EventEmitter<void>();
}
