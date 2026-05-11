import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, RouterLink],
  template: `
    <div class="glass-card p-10 sm:p-16 text-center animate-slide-up">
      <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        [ngClass]="iconBgClass || 'bg-violet-dim'">
        <ng-content select="[icon]"></ng-content>
      </div>
      <h3 class="text-base font-semibold text-white mb-1">{{ heading }}</h3>
      <p class="text-sm text-muted mb-5">{{ description }}</p>
      @if (ctaText && ctaRoute) {
        <a [routerLink]="ctaRoute" class="btn-primary">{{ ctaText }}</a>
      }
      <ng-content select="[actions]"></ng-content>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() heading = '';
  @Input() description = '';
  @Input() iconBgClass = 'bg-violet-dim';
  @Input() ctaText: string | null = null;
  @Input() ctaRoute: string | null = null;
}
