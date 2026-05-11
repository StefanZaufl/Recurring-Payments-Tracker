import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-editable-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!editing) {
      <div
        class="group flex items-center gap-1.5 cursor-pointer min-w-0"
        role="button"
        tabindex="0"
        (click)="startEdit.emit()"
        (keydown.enter)="startEdit.emit()"
        [attr.aria-label]="'Edit ' + label">
        <ng-content select="[display]" />
        <svg class="w-3.5 h-3.5 text-muted shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
        </svg>
      </div>
    }
    @if (editing) {
      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <ng-content select="[editor]" />
        <button (click)="save.emit()" aria-label="Save" class="p-1.5 text-accent hover:bg-accent-dim rounded-lg transition-colors shrink-0">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </button>
        <button (click)="cancelEdit.emit()" aria-label="Cancel" class="p-1.5 text-muted hover:bg-subtle rounded-lg transition-colors shrink-0">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    }
  `
})
export class EditableFieldComponent {
  @Input() editing = false;
  @Input() label = '';
  @Output() startEdit = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() cancelEdit = new EventEmitter<void>();
}
