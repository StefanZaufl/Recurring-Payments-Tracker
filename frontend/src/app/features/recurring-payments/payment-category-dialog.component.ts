import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { CategoryCreateComponent } from '../../shared/category-create.component';
import { ModalComponent } from '../../shared/modal.component';

@Component({
  selector: 'app-payment-category-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CategoryCreateComponent, ModalComponent],
  template: `
    <app-modal
      title="Set Category"
      [subtitle]="payment.name"
      size="sm"
      [scrollable]="false"
      (closeModal)="closed.emit()">
      <!-- Existing categories -->
      <div class="px-5 py-3 max-h-60 overflow-y-auto">
        <p class="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Existing categories</p>
        <!-- None option -->
        <button (click)="categorySelected.emit(null)"
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left transition-colors mb-1"
              [ngClass]="{
                'bg-subtle text-white': !payment.categoryId,
                'text-muted hover:bg-card-hover hover:text-white': payment.categoryId
              }">
          <span>None</span>
          @if (!payment.categoryId) {
            <svg class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          }
        </button>
        @for (cat of categories; track cat) {
          <button
            (click)="categorySelected.emit(cat.id)"
            class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left transition-colors mb-1"
              [ngClass]="{
                'bg-subtle text-white': payment.categoryId === cat.id,
                'text-muted hover:bg-card-hover hover:text-white': payment.categoryId !== cat.id
              }">
            <span>{{ cat.name }}</span>
            @if (payment.categoryId === cat.id) {
              <svg class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            }
          </button>
        }
      </div>
      <!-- Create new category -->
      <div class="px-5 py-4 border-t border-card-border">
        <p class="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Create new</p>
        <app-category-create (created)="categoryCreated.emit($event)"></app-category-create>
      </div>
    </app-modal>
  `
})
export class PaymentCategoryDialogComponent {
  @Input({ required: true }) payment!: RecurringPaymentDto;
  @Input() categories: CategoryDto[] = [];
  @Output() categorySelected = new EventEmitter<string | null>();
  @Output() categoryCreated = new EventEmitter<CategoryDto>();
  @Output() closed = new EventEmitter<void>();
}
