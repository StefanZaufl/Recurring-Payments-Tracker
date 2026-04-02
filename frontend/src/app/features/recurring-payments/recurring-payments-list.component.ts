import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecurringPaymentsService, CategoriesService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { CategoryCreateComponent } from '../../shared/category-create.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-recurring-payments-list',
  imports: [CommonModule, FormsModule, RouterLink, CategoryCreateComponent],
  template: `
    <div class="animate-fade-in">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Recurring Payments</h1>
          <p class="text-sm text-muted mt-0.5">Manage detected payment patterns</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <label class="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <div class="relative">
              <input type="checkbox" [(ngModel)]="showInactive"
                     class="sr-only peer"
                     (change)="applyFilter()">
              <div class="w-8 h-[18px] bg-subtle rounded-full peer-checked:bg-accent/30 transition-colors"></div>
              <div class="absolute top-[3px] left-[3px] w-3 h-3 bg-muted rounded-full peer-checked:translate-x-3.5 peer-checked:bg-accent transition-all"></div>
            </div>
            Show inactive
          </label>
          <select [(ngModel)]="filterFrequency" (change)="applyFilter()"
                  class="text-xs bg-card border border-card-border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-subtle">
            <option value="">All frequencies</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          <select [(ngModel)]="sortBy" (change)="applyFilter()"
                  class="text-xs bg-card border border-card-border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-subtle">
            <option value="amount">Sort by amount</option>
            <option value="name">Sort by name</option>
          </select>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="flex flex-col items-center justify-center py-20 gap-3">
        <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
        <span class="text-sm text-muted">Loading payments...</span>
      </div>

      <!-- Error state -->
      <div *ngIf="!loading && error" class="glass-card p-6 border-coral/20 animate-slide-up">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-coral-dim flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p class="text-sm text-coral font-medium">{{ error }}</p>
            <button (click)="loadData()" class="mt-2 text-xs text-muted hover:text-white transition-colors">Try again</button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && !error && filteredPayments.length === 0" class="glass-card p-10 sm:p-16 text-center animate-slide-up">
        <div class="w-16 h-16 rounded-2xl bg-violet-dim flex items-center justify-center mx-auto mb-5">
          <svg class="w-7 h-7 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
          </svg>
        </div>
        <h3 class="text-base font-semibold text-white mb-1">No recurring payments found</h3>
        <p class="text-sm text-muted mb-5">Upload bank transactions to detect patterns.</p>
        <a routerLink="/configure" class="btn-primary">Upload CSV</a>
      </div>

      <!-- Mobile card view -->
      <div *ngIf="!loading && filteredPayments.length > 0" class="sm:hidden space-y-3 animate-slide-up">
        <div *ngFor="let payment of filteredPayments"
             class="glass-card p-4 transition-opacity"
             [class.opacity-40]="!payment.isActive">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white truncate">{{ payment.name }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="badge"
                      [ngClass]="{
                        'bg-violet-dim text-violet': payment.frequency === 'MONTHLY',
                        'bg-amber-dim text-amber': payment.frequency === 'QUARTERLY',
                        'bg-sky-dim text-sky': payment.frequency === 'YEARLY'
                      }">
                  {{ payment.frequency }}
                </span>
                <span class="badge"
                      [ngClass]="{
                        'bg-accent-dim text-accent': payment.isIncome,
                        'bg-coral-dim text-coral': !payment.isIncome
                      }">
                  {{ payment.isIncome ? 'Income' : 'Expense' }}
                </span>
              </div>
            </div>
            <p class="font-mono text-sm font-semibold shrink-0 ml-3"
               [class.text-accent]="payment.isIncome"
               [class.text-coral]="!payment.isIncome">
              {{ payment.isIncome ? '+' : '-' }}{{ formatCurrency(abs(payment.averageAmount)) }}
            </p>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button (click)="toggleActive(payment)"
                      class="badge cursor-pointer transition-colors"
                      [ngClass]="{
                        'bg-accent-dim text-accent': payment.isActive,
                        'bg-subtle text-muted': !payment.isActive
                      }">
                {{ payment.isActive ? 'Active' : 'Inactive' }}
              </button>
              <button (click)="openCategoryDialog(payment)"
                      class="badge cursor-pointer transition-colors hover:bg-card-hover"
                      [ngClass]="{
                        'bg-subtle text-muted': payment.categoryName,
                        'bg-subtle text-muted/50': !payment.categoryName
                      }">
                {{ payment.categoryName || 'Uncategorized' }}
                <svg class="w-3 h-3 ml-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop table view -->
      <div *ngIf="!loading && filteredPayments.length > 0" class="hidden sm:block glass-card overflow-hidden animate-slide-up">
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="border-b border-card-border">
                <th class="table-header">Name</th>
                <th class="table-header">Category</th>
                <th class="table-header">Frequency</th>
                <th class="table-header text-right">Amount</th>
                <th class="table-header">Type</th>
                <th class="table-header">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-card-border">
              <tr *ngFor="let payment of filteredPayments"
                  class="hover:bg-card-hover transition-colors"
                  [class.opacity-40]="!payment.isActive">
                <td class="table-cell font-medium text-white">{{ payment.name }}</td>
                <td class="table-cell">
                  <button (click)="openCategoryDialog(payment)"
                          class="badge cursor-pointer transition-colors hover:bg-card-hover group"
                          [ngClass]="{
                            'bg-subtle text-muted': payment.categoryName,
                            'bg-subtle text-muted/50': !payment.categoryName
                          }">
                    {{ payment.categoryName || 'Uncategorized' }}
                    <svg class="w-3 h-3 ml-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                </td>
                <td class="table-cell">
                  <span class="badge"
                        [ngClass]="{
                          'bg-violet-dim text-violet': payment.frequency === 'MONTHLY',
                          'bg-amber-dim text-amber': payment.frequency === 'QUARTERLY',
                          'bg-sky-dim text-sky': payment.frequency === 'YEARLY'
                        }">
                    {{ payment.frequency }}
                  </span>
                </td>
                <td class="table-cell text-right font-mono text-xs font-medium"
                    [class.text-accent]="payment.isIncome"
                    [class.text-coral]="!payment.isIncome">
                  {{ payment.isIncome ? '+' : '-' }}{{ formatCurrency(abs(payment.averageAmount)) }}
                </td>
                <td class="table-cell">
                  <span class="badge"
                        [ngClass]="{
                          'bg-accent-dim text-accent': payment.isIncome,
                          'bg-coral-dim text-coral': !payment.isIncome
                        }">
                    {{ payment.isIncome ? 'Income' : 'Expense' }}
                  </span>
                </td>
                <td class="table-cell">
                  <button (click)="toggleActive(payment)"
                          class="badge cursor-pointer transition-colors"
                          [ngClass]="{
                            'bg-accent-dim text-accent': payment.isActive,
                            'bg-subtle text-muted': !payment.isActive
                          }">
                    {{ payment.isActive ? 'Active' : 'Inactive' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Category dialog backdrop -->
      <div *ngIf="dialogPayment"
           class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
           (click)="closeCategoryDialog()">
        <div class="glass-card w-full max-w-sm p-0 animate-slide-up border-subtle"
             (click)="$event.stopPropagation()">
          <!-- Dialog header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-card-border">
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-white">Set Category</h3>
              <p class="text-xs text-muted truncate mt-0.5">{{ dialogPayment.name }}</p>
            </div>
            <button (click)="closeCategoryDialog()"
                    class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-subtle text-muted hover:text-white transition-colors shrink-0 ml-3">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Existing categories -->
          <div class="px-5 py-3 max-h-60 overflow-y-auto">
            <p class="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Existing categories</p>

            <!-- None option -->
            <button (click)="selectCategory(null)"
                    class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left transition-colors mb-1"
                    [ngClass]="{
                      'bg-subtle text-white': !dialogPayment.categoryId,
                      'text-muted hover:bg-card-hover hover:text-white': dialogPayment.categoryId
                    }">
              <span>None</span>
              <svg *ngIf="!dialogPayment.categoryId" class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>

            <button *ngFor="let cat of categories"
                    (click)="selectCategory(cat.id)"
                    class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left transition-colors mb-1"
                    [ngClass]="{
                      'bg-subtle text-white': dialogPayment.categoryId === cat.id,
                      'text-muted hover:bg-card-hover hover:text-white': dialogPayment.categoryId !== cat.id
                    }">
              <span>{{ cat.name }}</span>
              <svg *ngIf="dialogPayment.categoryId === cat.id" class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
          </div>

          <!-- Create new category -->
          <div class="px-5 py-4 border-t border-card-border">
            <p class="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Create new</p>
            <app-category-create (created)="onDialogCategoryCreated($event)"></app-category-create>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RecurringPaymentsListComponent implements OnInit {
  payments: RecurringPaymentDto[] = [];
  filteredPayments: RecurringPaymentDto[] = [];
  categories: CategoryDto[] = [];
  loading = false;
  error: string | null = null;
  showInactive = false;
  filterFrequency = '';
  sortBy: 'amount' | 'name' = 'amount';

  // Category dialog state
  dialogPayment: RecurringPaymentDto | null = null;

  constructor(
    private recurringPaymentsService: RecurringPaymentsService,
    private categoriesService: CategoriesService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  applyFilter(): void {
    this.filteredPayments = this.payments.filter(p => {
      if (!this.showInactive && !p.isActive) return false;
      if (this.filterFrequency && p.frequency !== this.filterFrequency) return false;
      return true;
    });
    if (this.sortBy === 'amount') {
      this.filteredPayments.sort((a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount));
    } else {
      this.filteredPayments.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  toggleActive(payment: RecurringPaymentDto): void {
    this.recurringPaymentsService.updateRecurringPayment(payment.id, {
      isActive: !payment.isActive
    }).subscribe({
      next: (updated) => {
        Object.assign(payment, updated);
        this.applyFilter();
      }
    });
  }

  updateCategory(payment: RecurringPaymentDto, categoryId: string): void {
    this.recurringPaymentsService.updateRecurringPayment(payment.id, {
      categoryId: categoryId || undefined
    }).subscribe({
      next: (updated) => Object.assign(payment, updated)
    });
  }

  openCategoryDialog(payment: RecurringPaymentDto): void {
    this.dialogPayment = payment;
  }

  closeCategoryDialog(): void {
    this.dialogPayment = null;
  }

  selectCategory(categoryId: string | null): void {
    if (!this.dialogPayment) return;
    const payment = this.dialogPayment;
    this.recurringPaymentsService.updateRecurringPayment(payment.id, {
      categoryId: categoryId || undefined
    }).subscribe({
      next: (updated) => {
        Object.assign(payment, updated);
        this.closeCategoryDialog();
      }
    });
  }

  onDialogCategoryCreated(category: CategoryDto): void {
    this.categories = [...this.categories, category];
    this.selectCategory(category.id);
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      payments: this.recurringPaymentsService.getRecurringPayments(),
      categories: this.categoriesService.getCategories()
    }).subscribe({
      next: ({ payments, categories }) => {
        this.payments = payments;
        this.categories = categories;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load recurring payments. Please try again.';
        this.loading = false;
      }
    });
  }
}
