import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-frequency-badge',
  imports: [CommonModule],
  template: `
    <span class="badge"
      [ngClass]="{
        'bg-violet-dim text-violet': frequency === 'MONTHLY',
        'bg-amber-dim text-amber': frequency === 'QUARTERLY',
        'bg-sky-dim text-sky': frequency === 'YEARLY'
      }">{{ frequency }}</span>
  `
})
export class FrequencyBadgeComponent {
  @Input() frequency = '';
}
