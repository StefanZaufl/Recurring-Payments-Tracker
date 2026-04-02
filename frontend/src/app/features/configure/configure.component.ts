import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TransactionsService, CategoriesService } from '../../api/generated';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { UploadResponse } from '../../api/generated/model/uploadResponse';

@Component({
  selector: 'app-configure',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="animate-fade-in">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Configure</h1>
        <p class="text-sm text-muted mt-0.5">Import data and manage categories</p>
      </div>

      <div class="grid gap-6 lg:gap-8">
        <!-- ─── Upload Section ─── -->
        <section>
          <div class="flex items-center gap-2 mb-4">
            <div class="w-7 h-7 rounded-lg bg-accent-dim flex items-center justify-center shrink-0">
              <svg class="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <h2 class="text-base font-semibold text-white">Import Transactions</h2>
          </div>

          <div class="max-w-lg">
            <div
              class="glass-card p-10 sm:p-14 text-center cursor-pointer group transition-all duration-300"
              [class.border-accent]="isDragging"
              [class.bg-accent-dim]="isDragging"
              [class.scale-105]="isDragging"
              (dragover)="onDragOver($event)"
              (dragleave)="isDragging = false"
              (drop)="onDrop($event)"
              (click)="fileInput.click()">

              <input #fileInput type="file" accept=".csv" class="hidden" (change)="onFileSelected($event)" />

              <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-colors duration-300 bg-accent-dim">
                <svg class="w-7 h-7 transition-colors duration-300 text-accent"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>

              <p class="text-sm font-medium text-white mb-1.5">
                {{ isDragging ? 'Drop your file here' : 'Drag & drop your CSV file' }}
              </p>
              <p class="text-xs text-muted mb-5">or click to browse</p>

              <div class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-subtle text-xs text-muted">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                .csv files only
              </div>
            </div>

            @if (uploading) {
              <div class="glass-card p-5 mt-4 animate-slide-up">
                <div class="flex items-center gap-3">
                  <div class="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin shrink-0"></div>
                  <span class="text-sm text-muted">Uploading and processing...</span>
                </div>
              </div>
            }

            @if (uploadResult) {
              <div class="glass-card p-5 mt-4 border-accent/20 animate-slide-up">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-accent mb-1">Upload successful</p>
                    <p class="text-xs text-muted">
                      <span class="font-mono text-white">{{ uploadResult.transactionCount }}</span> transactions imported
                    </p>
                    <p class="text-xs text-muted">
                      <span class="font-mono text-white">{{ uploadResult.recurringPaymentsDetected }}</span> recurring payments detected
                    </p>
                    <a routerLink="/dashboard" class="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:text-accent/80 transition-colors">
                      View dashboard
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            }

            @if (uploadError) {
              <div class="glass-card p-5 mt-4 border-coral/20 animate-slide-up">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-coral-dim flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <p class="text-sm text-coral">{{ uploadError }}</p>
                </div>
              </div>
            }

            <div class="mt-4 px-1">
              <p class="text-[11px] text-muted/60 leading-relaxed">
                Accepts semicolon-delimited CSV with columns: Buchungsdatum, Partnername, Betrag.
                European date (DD.MM.YYYY) and number formats (-12,99).
              </p>
            </div>
          </div>
        </section>

        <!-- ─── Divider ─── -->
        <div class="border-t border-card-border"></div>

        <!-- ─── Categories Section ─── -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-violet-dim flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
                </svg>
              </div>
              <h2 class="text-base font-semibold text-white">Categories</h2>
            </div>
            <span class="text-xs text-muted font-mono" *ngIf="!categoriesLoading">{{ categories.length }}</span>
          </div>

          <!-- Loading -->
          <div *ngIf="categoriesLoading" class="flex items-center gap-3 py-8">
            <div class="w-5 h-5 border-2 border-violet/30 border-t-violet rounded-full animate-spin"></div>
            <span class="text-sm text-muted">Loading categories...</span>
          </div>

          <!-- Error -->
          <div *ngIf="!categoriesLoading && categoriesError" class="glass-card p-5 border-coral/20">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-coral-dim flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p class="text-sm text-coral font-medium">{{ categoriesError }}</p>
                <button (click)="loadCategories()" class="mt-2 text-xs text-muted hover:text-white transition-colors">Try again</button>
              </div>
            </div>
          </div>

          <!-- Create new category -->
          <div *ngIf="!categoriesLoading && !categoriesError" class="glass-card p-4 mb-4">
            <div class="flex gap-2">
              <input [(ngModel)]="newCategoryName"
                     (keydown.enter)="createCategory()"
                     placeholder="New category name..."
                     class="flex-1 text-sm bg-subtle border-0 rounded-xl px-3 py-2.5 text-white placeholder-muted/50 focus:outline-none focus:ring-1 focus:ring-violet/40">
              <input [(ngModel)]="newCategoryColor"
                     type="color"
                     class="w-10 h-10 rounded-xl bg-subtle border-0 cursor-pointer shrink-0"
                     title="Pick a color">
              <button (click)="createCategory()"
                      [disabled]="!newCategoryName.trim() || creatingCategory"
                      class="px-4 py-2.5 bg-violet text-white text-xs font-semibold rounded-xl transition-all
                             hover:brightness-110 active:scale-[0.97]
                             disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100">
                <span *ngIf="!creatingCategory">Add</span>
                <div *ngIf="creatingCategory" class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              </button>
            </div>
            <p *ngIf="createError" class="text-xs text-coral mt-2">{{ createError }}</p>
          </div>

          <!-- Empty state -->
          <div *ngIf="!categoriesLoading && !categoriesError && categories.length === 0" class="glass-card p-8 text-center">
            <p class="text-sm text-muted">No categories yet. Create one above to get started.</p>
          </div>

          <!-- Categories list -->
          <div *ngIf="!categoriesLoading && !categoriesError && categories.length > 0" class="space-y-2">
            <div *ngFor="let category of categories"
                 class="glass-card p-4 flex items-center gap-3 group transition-colors hover:border-subtle">

              <!-- Color dot -->
              <div class="w-3 h-3 rounded-full shrink-0"
                   [style.background-color]="category.color || '#6b7194'"></div>

              <!-- View mode -->
              <ng-container *ngIf="editingId !== category.id">
                <span class="text-sm text-white flex-1 truncate">{{ category.name }}</span>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button (click)="startEdit(category)"
                          class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors"
                          title="Edit">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  <button (click)="deleteCategory(category)"
                          [disabled]="deletingId === category.id"
                          class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-coral-dim text-muted hover:text-coral transition-colors
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Delete">
                    <svg *ngIf="deletingId !== category.id" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    <div *ngIf="deletingId === category.id" class="w-3 h-3 border-2 border-coral/30 border-t-coral rounded-full animate-spin"></div>
                  </button>
                </div>
              </ng-container>

              <!-- Edit mode -->
              <ng-container *ngIf="editingId === category.id">
                <input [(ngModel)]="editName"
                       (keydown.enter)="saveEdit(category)"
                       (keydown.escape)="cancelEdit()"
                       class="flex-1 text-sm bg-subtle border-0 rounded-lg px-3 py-1.5 text-white placeholder-muted/50 focus:outline-none focus:ring-1 focus:ring-violet/40">
                <input [(ngModel)]="editColor"
                       type="color"
                       class="w-8 h-8 rounded-lg bg-subtle border-0 cursor-pointer shrink-0">
                <button (click)="saveEdit(category)"
                        [disabled]="!editName.trim() || savingEdit"
                        class="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-dim text-accent hover:brightness-110 transition-all
                               disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg *ngIf="!savingEdit" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <div *ngIf="savingEdit" class="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                </button>
                <button (click)="cancelEdit()"
                        class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </ng-container>
            </div>
          </div>

          <p *ngIf="deleteError" class="text-xs text-coral mt-3">{{ deleteError }}</p>
          <p *ngIf="editError" class="text-xs text-coral mt-3">{{ editError }}</p>
        </section>
      </div>
    </div>
  `
})
export class ConfigureComponent implements OnInit {
  // Upload state
  isDragging = false;
  uploading = false;
  uploadResult: UploadResponse | null = null;
  uploadError: string | null = null;

  // Categories state
  categories: CategoryDto[] = [];
  categoriesLoading = false;
  categoriesError: string | null = null;

  // Create category
  newCategoryName = '';
  newCategoryColor = '#a78bfa';
  creatingCategory = false;
  createError: string | null = null;

  // Edit category
  editingId: string | null = null;
  editName = '';
  editColor = '';
  savingEdit = false;
  editError: string | null = null;

  // Delete category
  deletingId: string | null = null;
  deleteError: string | null = null;

  constructor(
    private transactionsService: TransactionsService,
    private categoriesService: CategoriesService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  // ─── Upload ───

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.upload(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.upload(file);
  }

  private upload(file: File): void {
    this.uploading = true;
    this.uploadResult = null;
    this.uploadError = null;
    this.transactionsService.uploadCsv(file).subscribe({
      next: (res) => {
        this.uploadResult = res;
        this.uploading = false;
      },
      error: (err) => {
        this.uploadError = err.error?.message || 'Upload failed. Please try again.';
        this.uploading = false;
      }
    });
  }

  // ─── Categories CRUD ───

  loadCategories(): void {
    this.categoriesLoading = true;
    this.categoriesError = null;
    this.categoriesService.getCategories().subscribe({
      next: (cats) => {
        this.categories = cats;
        this.categoriesLoading = false;
      },
      error: (err) => {
        this.categoriesError = err.error?.message || 'Failed to load categories.';
        this.categoriesLoading = false;
      }
    });
  }

  createCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) return;

    this.creatingCategory = true;
    this.createError = null;
    this.categoriesService.createCategory({ name, color: this.newCategoryColor }).subscribe({
      next: (created) => {
        this.categories = [...this.categories, created];
        this.newCategoryName = '';
        this.newCategoryColor = '#a78bfa';
        this.creatingCategory = false;
      },
      error: (err) => {
        this.createError = err.error?.message || 'Failed to create category.';
        this.creatingCategory = false;
      }
    });
  }

  startEdit(category: CategoryDto): void {
    this.editingId = category.id;
    this.editName = category.name;
    this.editColor = category.color || '#6b7194';
    this.editError = null;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editName = '';
    this.editColor = '';
    this.editError = null;
  }

  saveEdit(category: CategoryDto): void {
    const name = this.editName.trim();
    if (!name) return;

    this.savingEdit = true;
    this.editError = null;
    this.categoriesService.updateCategory(category.id, { name, color: this.editColor }).subscribe({
      next: (updated) => {
        const idx = this.categories.findIndex(c => c.id === category.id);
        if (idx !== -1) this.categories[idx] = updated;
        this.cancelEdit();
        this.savingEdit = false;
      },
      error: (err) => {
        this.editError = err.error?.message || 'Failed to update category.';
        this.savingEdit = false;
      }
    });
  }

  deleteCategory(category: CategoryDto): void {
    this.deletingId = category.id;
    this.deleteError = null;
    this.categoriesService.deleteCategory(category.id).subscribe({
      next: () => {
        this.categories = this.categories.filter(c => c.id !== category.id);
        this.deletingId = null;
      },
      error: (err) => {
        this.deleteError = err.error?.message || 'Failed to delete category.';
        this.deletingId = null;
      }
    });
  }
}
