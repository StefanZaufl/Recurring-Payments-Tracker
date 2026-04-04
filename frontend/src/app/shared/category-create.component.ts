import { Component, EventEmitter, Output, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CategoriesService } from '../api/generated';
import { CategoryDto } from '../api/generated/model/categoryDto';

@Component({
  selector: 'app-category-create',
  imports: [FormsModule],
  template: `
    <div class="flex flex-wrap gap-2">
      <input [(ngModel)]="name"
        (keydown.enter)="create()"
        placeholder="Category name..."
        class="flex-1 min-w-0 text-sm bg-subtle border-0 rounded-xl px-3 py-2.5 text-white placeholder-muted/50 focus:outline-none focus:ring-1 focus:ring-violet/40">
        <div class="flex gap-2 shrink-0">
          <input [(ngModel)]="color"
            type="color"
            class="w-10 h-10 rounded-xl bg-subtle border-0 cursor-pointer shrink-0"
            title="Pick a color">
          <button (click)="create()"
            [disabled]="!name.trim() || creating"
                class="px-4 py-2.5 bg-violet text-white text-xs font-semibold rounded-xl transition-all
                       hover:brightness-110 active:scale-[0.97]
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100">
            @if (!creating) {
              <span>Add</span>
            }
            @if (creating) {
              <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            }
          </button>
        </div>
      </div>
      @if (error) {
        <p class="text-xs text-coral mt-2">{{ error }}</p>
      }
    `
})
export class CategoryCreateComponent {
  private categoriesService = inject(CategoriesService);

  @Output() created = new EventEmitter<CategoryDto>();

  name = '';
  color = '#a78bfa';
  creating = false;
  error: string | null = null;

  create(): void {
    const name = this.name.trim();
    if (!name) return;

    this.creating = true;
    this.error = null;
    this.categoriesService.createCategory({ name, color: this.color }).subscribe({
      next: (created) => {
        this.created.emit(created);
        this.name = '';
        this.color = '#a78bfa';
        this.creating = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to create category.';
        this.creating = false;
      }
    });
  }
}
