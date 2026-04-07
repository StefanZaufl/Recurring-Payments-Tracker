import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { BankAccountsService, CategoriesService } from '../../api/generated';
import { BankAccountDto } from '../../api/generated/model/bankAccountDto';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { CategoryCreateComponent } from '../../shared/category-create.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-configure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CategoryCreateComponent, LoadingSpinnerComponent, ErrorStateComponent],
  template: `
    <div class="animate-fade-in min-w-0 overflow-hidden">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Configure</h1>
        <p class="text-sm text-muted mt-0.5">Manage categories and bank accounts</p>
      </div>
    
      <div class="grid gap-6 lg:gap-8">
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
            @if (!categoriesLoading) {
              <span class="text-xs text-muted font-mono">{{ categories.length }}</span>
            }
          </div>
    
          <!-- Loading -->
          @if (categoriesLoading) {
            <app-loading-spinner message="Loading categories..." />
          }

          <!-- Error -->
          @if (!categoriesLoading && categoriesError) {
            <app-error-state [message]="categoriesError" (retry)="loadCategories()" />
          }
    
          <!-- Create new category -->
          @if (!categoriesLoading && !categoriesError) {
            <div class="glass-card p-4 mb-4">
              <app-category-create (created)="onCategoryCreated($event)"></app-category-create>
            </div>
          }
    
          <!-- Empty state -->
          @if (!categoriesLoading && !categoriesError && categories.length === 0) {
            <div class="glass-card p-8 text-center">
              <p class="text-sm text-muted">No categories yet. Create one above to get started.</p>
            </div>
          }
    
          <!-- Categories list -->
          @if (!categoriesLoading && !categoriesError && categories.length > 0) {
            <div class="space-y-2">
              @for (category of categories; track category) {
                <div
                  class="glass-card p-4 group transition-colors hover:border-subtle">
                  <!-- View mode -->
                  @if (editingId !== category.id) {
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-3 h-3 rounded-full shrink-0"
                      [style.background-color]="category.color || '#6b7194'"></div>
                      <span class="text-sm text-white flex-1 truncate min-w-0">{{ category.name }}</span>
                      <div class="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button (click)="startEdit(category)"
                          class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors"
                          aria-label="Edit category" title="Edit">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                        <button (click)="deleteCategory(category)"
                          [disabled]="deletingId === category.id"
                          class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-coral-dim text-muted hover:text-coral transition-colors
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Delete category" title="Delete">
                          @if (deletingId !== category.id) {
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          }
                          @if (deletingId === category.id) {
                            <div class="w-3 h-3 border-2 border-coral/30 border-t-coral rounded-full animate-spin"></div>
                          }
                        </button>
                      </div>
                    </div>
                  }
                  <!-- Edit mode -->
                  @if (editingId === category.id) {
                    <div class="flex flex-wrap items-center gap-2 min-w-0">
                      <input [(ngModel)]="editName"
                        (keydown.enter)="saveEdit(category)"
                        (keydown.escape)="cancelEdit()"
                        class="flex-1 min-w-0 text-sm bg-subtle border-0 rounded-lg px-3 py-1.5 text-white placeholder-muted/50 focus:outline-none focus:ring-1 focus:ring-violet/40">
                        <div class="flex items-center gap-1 shrink-0">
                          <input [(ngModel)]="editColor"
                            type="color"
                            class="w-8 h-8 rounded-lg bg-subtle border-0 cursor-pointer shrink-0">
                          <button (click)="saveEdit(category)"
                            [disabled]="!editName.trim() || savingEdit"
                            aria-label="Save changes"
                          class="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-dim text-accent hover:brightness-110 transition-all
                                 disabled:opacity-40 disabled:cursor-not-allowed">
                            @if (!savingEdit) {
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            }
                            @if (savingEdit) {
                              <div class="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                            }
                          </button>
                          <button (click)="cancelEdit()"
                            aria-label="Cancel"
                            class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
    
            @if (deleteError) {
              <p class="text-xs text-coral mt-3">{{ deleteError }}</p>
            }
            @if (editError) {
              <p class="text-xs text-coral mt-3">{{ editError }}</p>
            }
          </section>

        <section>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-accent-dim flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5h18M5.25 6.75h13.5A2.25 2.25 0 0121 9v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V9a2.25 2.25 0 012.25-2.25z" />
                </svg>
              </div>
              <h2 class="text-base font-semibold text-white">Bank Accounts</h2>
            </div>
            @if (!bankAccountsLoading) {
              <span class="text-xs text-muted font-mono">{{ bankAccounts.length }}</span>
            }
          </div>

          @if (bankAccountsLoading) {
            <app-loading-spinner message="Loading bank accounts..." />
          }

          @if (!bankAccountsLoading && bankAccountsError) {
            <app-error-state [message]="bankAccountsError" (retry)="loadBankAccounts()" />
          }

          @if (!bankAccountsLoading && !bankAccountsError) {
            <div class="glass-card p-4 mb-4">
              <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <div>
                  <label for="bank-account-iban" class="text-[11px] text-muted mb-1 block uppercase tracking-wider font-medium">IBAN</label>
                  <input id="bank-account-iban" [(ngModel)]="newBankAccountIban"
                    class="w-full text-sm bg-subtle border border-card-border rounded-xl px-4 py-2.5 text-white placeholder-muted/50 focus:outline-none focus:border-accent/40 transition-colors"
                    placeholder="DE12 3456 7890 1234 5678 90">
                </div>
                <div>
                  <label for="bank-account-name" class="text-[11px] text-muted mb-1 block uppercase tracking-wider font-medium">Name</label>
                  <input id="bank-account-name" [(ngModel)]="newBankAccountName"
                    class="w-full text-sm bg-subtle border border-card-border rounded-xl px-4 py-2.5 text-white placeholder-muted/50 focus:outline-none focus:border-accent/40 transition-colors"
                    placeholder="Checking">
                </div>
                <button (click)="createBankAccount()"
                  [disabled]="creatingBankAccount || !newBankAccountIban.trim()"
                  class="btn-primary h-[42px] justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                  @if (!creatingBankAccount) {
                    Add account
                  } @else {
                    <span class="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin"></span>
                  }
                </button>
              </div>
              @if (createBankAccountError) {
                <p class="text-xs text-coral mt-3">{{ createBankAccountError }}</p>
              }
            </div>
          }

          @if (!bankAccountsLoading && !bankAccountsError && bankAccounts.length === 0) {
            <div class="glass-card p-8 text-center">
              <p class="text-sm text-muted">No bank accounts yet. Add one above or import a CSV with an account IBAN.</p>
            </div>
          }

          @if (!bankAccountsLoading && !bankAccountsError && bankAccounts.length > 0) {
            <div class="space-y-2">
              @for (bankAccount of bankAccounts; track bankAccount.id) {
                <div class="glass-card p-4 group transition-colors hover:border-subtle">
                  @if (editingBankAccountId !== bankAccount.id) {
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="min-w-0 flex-1">
                        <p class="text-sm text-white truncate">{{ bankAccount.name || 'Unnamed account' }}</p>
                        <p class="text-xs text-muted font-mono truncate mt-0.5">{{ bankAccount.iban }}</p>
                      </div>
                      <div class="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button (click)="startBankAccountEdit(bankAccount)"
                          class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors"
                          aria-label="Edit bank account" title="Edit">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                        <button (click)="deleteBankAccount(bankAccount)"
                          [disabled]="deletingBankAccountId === bankAccount.id"
                          class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-coral-dim text-muted hover:text-coral transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Delete bank account" title="Delete">
                          @if (deletingBankAccountId !== bankAccount.id) {
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          } @else {
                            <div class="w-3 h-3 border-2 border-coral/30 border-t-coral rounded-full animate-spin"></div>
                          }
                        </button>
                      </div>
                    </div>
                  }
                  @if (editingBankAccountId === bankAccount.id) {
                    <div class="flex flex-wrap items-center gap-2 min-w-0">
                      <div class="min-w-0 flex-1">
                        <input [(ngModel)]="editBankAccountName"
                          (keydown.enter)="saveBankAccountEdit(bankAccount)"
                          (keydown.escape)="cancelBankAccountEdit()"
                          class="w-full text-sm bg-subtle border-0 rounded-lg px-3 py-1.5 text-white placeholder-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/40"
                          placeholder="Account name">
                        <p class="text-xs text-muted font-mono mt-2 truncate">{{ bankAccount.iban }}</p>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <button (click)="saveBankAccountEdit(bankAccount)"
                          [disabled]="savingBankAccountEdit"
                          class="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-dim text-accent hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          @if (!savingBankAccountEdit) {
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          } @else {
                            <div class="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                          }
                        </button>
                        <button (click)="cancelBankAccountEdit()"
                          class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

          @if (bankAccountEditError) {
            <p class="text-xs text-coral mt-3">{{ bankAccountEditError }}</p>
          }
          @if (deleteBankAccountError) {
            <p class="text-xs text-coral mt-3">{{ deleteBankAccountError }}</p>
          }
        </section>
        </div>
      </div>
    `
})
export class ConfigureComponent implements OnInit, OnDestroy {
  private categoriesService = inject(CategoriesService);
  private bankAccountsService = inject(BankAccountsService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  // Categories state
  categories: CategoryDto[] = [];
  categoriesLoading = false;
  categoriesError: string | null = null;

  // Edit category
  editingId: string | null = null;
  editName = '';
  editColor = '';
  savingEdit = false;
  editError: string | null = null;

  // Delete category
  deletingId: string | null = null;
  deleteError: string | null = null;

  bankAccounts: BankAccountDto[] = [];
  bankAccountsLoading = false;
  bankAccountsError: string | null = null;
  newBankAccountIban = '';
  newBankAccountName = '';
  creatingBankAccount = false;
  createBankAccountError: string | null = null;
  editingBankAccountId: string | null = null;
  editBankAccountName = '';
  savingBankAccountEdit = false;
  bankAccountEditError: string | null = null;
  deletingBankAccountId: string | null = null;
  deleteBankAccountError: string | null = null;

  ngOnInit(): void {
    this.loadCategories();
    this.loadBankAccounts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Categories CRUD ───

  loadCategories(): void {
    this.categoriesLoading = true;
    this.categoriesError = null;
    this.categoriesService.getCategories().pipe(takeUntil(this.destroy$)).subscribe({
      next: (cats) => {
        this.categories = cats;
        this.categoriesLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.categoriesError = err.error?.message || 'Failed to load categories.';
        this.categoriesLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onCategoryCreated(category: CategoryDto): void {
    this.categories = [...this.categories, category];
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
    this.categoriesService.updateCategory(category.id, { name, color: this.editColor }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const idx = this.categories.findIndex(c => c.id === category.id);
        if (idx !== -1) this.categories[idx] = updated;
        this.cancelEdit();
        this.savingEdit = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.editError = err.error?.message || 'Failed to update category.';
        this.savingEdit = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteCategory(category: CategoryDto): void {
    this.deletingId = category.id;
    this.deleteError = null;
    this.categoriesService.deleteCategory(category.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.categories = this.categories.filter(c => c.id !== category.id);
        this.deletingId = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.deleteError = err.error?.message || 'Failed to delete category.';
        this.deletingId = null;
        this.cdr.markForCheck();
      }
    });
  }

  loadBankAccounts(): void {
    this.bankAccountsLoading = true;
    this.bankAccountsError = null;
    this.bankAccountsService.getBankAccounts().pipe(takeUntil(this.destroy$)).subscribe({
      next: (accounts) => {
        this.bankAccounts = accounts;
        this.bankAccountsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.bankAccountsError = err.error?.message || 'Failed to load bank accounts.';
        this.bankAccountsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  createBankAccount(): void {
    const iban = this.newBankAccountIban.trim();
    if (!iban) {
      return;
    }

    this.creatingBankAccount = true;
    this.createBankAccountError = null;
    this.bankAccountsService.createBankAccount({
      iban,
      name: this.newBankAccountName.trim() || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (account) => {
        this.bankAccounts = [...this.bankAccounts.filter(existing => existing.id !== account.id), account]
          .sort((a, b) => (a.name || a.iban).localeCompare(b.name || b.iban));
        this.newBankAccountIban = '';
        this.newBankAccountName = '';
        this.creatingBankAccount = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.createBankAccountError = err.error?.message || 'Failed to create bank account.';
        this.creatingBankAccount = false;
        this.cdr.markForCheck();
      }
    });
  }

  startBankAccountEdit(account: BankAccountDto): void {
    this.editingBankAccountId = account.id;
    this.editBankAccountName = account.name || '';
    this.bankAccountEditError = null;
  }

  cancelBankAccountEdit(): void {
    this.editingBankAccountId = null;
    this.editBankAccountName = '';
    this.bankAccountEditError = null;
  }

  saveBankAccountEdit(account: BankAccountDto): void {
    this.savingBankAccountEdit = true;
    this.bankAccountEditError = null;
    this.bankAccountsService.updateBankAccount(account.id, {
      name: this.editBankAccountName.trim() || null
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const idx = this.bankAccounts.findIndex(existing => existing.id === account.id);
        if (idx !== -1) {
          this.bankAccounts[idx] = updated;
          this.bankAccounts = [...this.bankAccounts];
        }
        this.cancelBankAccountEdit();
        this.savingBankAccountEdit = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.bankAccountEditError = err.error?.message || 'Failed to update bank account.';
        this.savingBankAccountEdit = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteBankAccount(account: BankAccountDto): void {
    this.deletingBankAccountId = account.id;
    this.deleteBankAccountError = null;
    this.bankAccountsService.deleteBankAccount(account.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.bankAccounts = this.bankAccounts.filter(existing => existing.id !== account.id);
        this.deletingBankAccountId = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.deleteBankAccountError = err.error?.message || 'Failed to delete bank account.';
        this.deletingBankAccountId = null;
        this.cdr.markForCheck();
      }
    });
  }
}
