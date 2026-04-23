import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-toggle-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <label class="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
      <div class="relative">
        <input
          type="checkbox"
          [ngModel]="checked"
          (ngModelChange)="checkedChange.emit($event)"
          class="sr-only peer">
        <div
          class="bg-subtle rounded-full peer-checked:bg-accent/30 transition-colors"
          [class.w-8]="size === 'md'"
          [class.h-[18px]]="size === 'md'"
          [class.w-7]="size === 'sm'"
          [class.h-[16px]]="size === 'sm'">
        </div>
        @if (size === 'md') {
          <div class="absolute top-[3px] left-[3px] w-3 h-3 bg-muted rounded-full peer-checked:translate-x-3.5 peer-checked:bg-accent transition-all"></div>
        } @else {
          <div class="absolute top-[2px] left-[2px] w-3 h-3 bg-muted rounded-full peer-checked:translate-x-3 peer-checked:bg-accent transition-all"></div>
        }
      </div>
      @if (label) {
        <span [class.text-[11px]]="size === 'sm'">{{ label }}</span>
      }
    </label>
  `,
})
export class ToggleSwitchComponent {
  @Input() checked = false;
  @Input() label = '';
  @Input() size: 'sm' | 'md' = 'md';
  @Output() checkedChange = new EventEmitter<boolean>();
}
