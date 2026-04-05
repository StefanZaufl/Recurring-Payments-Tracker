import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AnalyticsService } from '../../api/generated';
import { AnnualOverview } from '../../api/generated/model/annualOverview';
import { Subject, takeUntil } from 'rxjs';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { CHART_THEME } from '../../shared/constants';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BaseChartDirective, LoadingSpinnerComponent, ErrorStateComponent, CurrencyFormatPipe],
  template: `
    <div class="animate-fade-in">
      <!-- Header row -->
      <div class="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p class="text-sm text-muted mt-0.5">Annual financial overview</p>
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <button (click)="changeYear(-1)" aria-label="Previous year"
            class="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-card-border text-muted hover:text-white hover:border-subtle transition-all">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span class="px-4 py-2 text-sm font-mono font-semibold text-white bg-card border border-card-border rounded-xl min-w-[5.5rem] text-center">
            {{ selectedYear }}
          </span>
          <button (click)="changeYear(1)" aria-label="Next year"
            class="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-card-border text-muted hover:text-white hover:border-subtle transition-all">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
    
      <!-- Loading -->
      @if (loading) {
        <app-loading-spinner message="Loading data..." />
      }

      <!-- Error state -->
      @if (!loading && error) {
        <app-error-state [message]="error" (retry)="loadData()" />
      }
    
      <!-- Empty state -->
      @if (!loading && !error && !overview) {
        <div class="glass-card p-10 sm:p-16 text-center animate-slide-up">
          <div class="w-16 h-16 rounded-2xl bg-accent-dim flex items-center justify-center mx-auto mb-5">
            <svg class="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <h3 class="text-base font-semibold text-white mb-1">No data for {{ selectedYear }}</h3>
          <p class="text-sm text-muted mb-5">Upload a CSV to see your annual overview.</p>
          <a routerLink="/upload" class="btn-primary">Upload CSV</a>
        </div>
      }
    
      <!-- Dashboard content -->
      @if (!loading && overview) {
        <div class="animate-slide-up">
          <!-- Summary cards -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div class="glass-card p-4 sm:p-5 min-w-0 group hover:border-accent/30 transition-colors">
              <p class="stat-label mb-2">Income</p>
              <p class="stat-value text-accent">{{ overview.totalIncome | appCurrency }}</p>
            </div>
            <div class="glass-card p-4 sm:p-5 min-w-0 group hover:border-coral/30 transition-colors">
              <p class="stat-label mb-2">Expenses</p>
              <p class="stat-value text-coral">{{ overview.totalExpenses | appCurrency }}</p>
            </div>
            <div class="glass-card p-4 sm:p-5 min-w-0 group hover:border-amber/30 transition-colors">
              <p class="stat-label mb-2">Recurring</p>
              <p class="stat-value text-amber">{{ overview.totalRecurringExpenses | appCurrency }}</p>
            </div>
            <div class="glass-card p-4 sm:p-5 min-w-0 group transition-colors">
              <p class="stat-label mb-2">Surplus</p>
              <p class="stat-value"
                [class.text-accent]="overview.totalIncome - overview.totalExpenses >= 0"
                [class.text-coral]="overview.totalIncome - overview.totalExpenses < 0">
                {{ overview.totalIncome - overview.totalExpenses | appCurrency }}
              </p>
            </div>
          </div>
          <!-- Charts row -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8">
            <!-- Monthly bar chart -->
            <div class="lg:col-span-2 glass-card p-4 sm:p-5">
              <h2 class="text-sm font-semibold text-white mb-4">Monthly Income vs Expenses</h2>
              <div class="h-56 sm:h-72">
                <canvas baseChart
                  role="img"
                  aria-label="Bar chart showing monthly income versus expenses"
                  [datasets]="barChartData.datasets"
                  [labels]="barChartData.labels"
                  [options]="barChartOptions"
                  type="bar">
                </canvas>
              </div>
            </div>
            <!-- Category chart -->
            <div class="glass-card p-4 sm:p-5">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm font-semibold text-white">By Category</h2>
                @if (overview.byCategory.length > 0) {
                  <button (click)="toggleCategoryChart()" aria-label="Toggle chart type"
                    class="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-card-border text-muted hover:text-white hover:border-subtle transition-all">
                    @if (categoryChartType === 'doughnut') {
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l3-9 4 18 3-9h4" />
                      </svg>
                    } @else {
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 3v9l6.36 3.64" />
                      </svg>
                    }
                  </button>
                }
              </div>
              @if (overview.byCategory.length > 0) {
                <div class="h-56 sm:h-72 flex items-center justify-center">
                  @if (categoryChartType === 'doughnut') {
                    <canvas baseChart
                      role="img"
                      aria-label="Doughnut chart showing expense breakdown by category"
                      [datasets]="pieChartData.datasets"
                      [labels]="pieChartData.labels"
                      [options]="pieChartOptions"
                      type="doughnut">
                    </canvas>
                  } @else {
                    <canvas baseChart
                      role="img"
                      aria-label="Bar chart showing expense breakdown by category"
                      [datasets]="categoryBarChartData.datasets"
                      [labels]="categoryBarChartData.labels"
                      [options]="categoryBarChartOptions"
                      type="bar">
                    </canvas>
                  }
                </div>
              }
              @if (overview.byCategory.length === 0) {
                <div class="h-56 sm:h-72 flex items-center justify-center">
                  <p class="text-sm text-muted text-center">No categorized<br>recurring payments yet.</p>
                </div>
              }
            </div>
          </div>
          <!-- Recurring payments table -->
          <div class="glass-card overflow-hidden">
            <div class="px-4 sm:px-5 py-4 border-b border-card-border flex items-center justify-between">
              <h2 class="text-sm font-semibold text-white">Recurring Payments</h2>
              <span class="text-xs text-muted font-mono">{{ overview.recurringPayments.length }} items</span>
            </div>
            @if (overview.recurringPayments.length === 0) {
              <div class="p-6 text-center">
                <p class="text-sm text-muted">No recurring payments detected for this year.</p>
              </div>
            }
            @if (overview.recurringPayments.length > 0) {
              <div class="overflow-x-auto">
                <table class="min-w-full">
                  <thead>
                    <tr class="border-b border-card-border">
                      <th class="table-header">Name</th>
                      <th class="table-header">Category</th>
                      <th class="table-header text-right">Monthly</th>
                      <th class="table-header text-right">Annual</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-card-border">
                    @for (payment of overview.recurringPayments; track payment) {
                      <tr
                        class="hover:bg-card-hover transition-colors">
                        <td class="table-cell font-medium text-white">{{ payment.name }}</td>
                        <td class="table-cell">
                          <span class="badge bg-subtle text-muted">{{ payment.category }}</span>
                        </td>
                        <td class="table-cell text-right font-mono text-coral text-xs">{{ payment.monthlyAmount | appCurrency }}</td>
                        <td class="table-cell text-right font-mono text-coral text-xs">{{ payment.annualAmount | appCurrency }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
    </div>
    `
})
export class DashboardComponent implements OnInit, OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  selectedYear = new Date().getFullYear();
  loading = false;
  error: string | null = null;
  overview: AnnualOverview | null = null;

  private readonly monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  barChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: CHART_THEME.labelColor, font: { family: CHART_THEME.fontFamily, size: 11 }, boxWidth: 10, padding: 16 }
      }
    },
    scales: {
      x: {
        grid: { color: CHART_THEME.gridColor },
        ticks: { color: CHART_THEME.labelColor, font: { family: CHART_THEME.fontFamily, size: 10 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: CHART_THEME.gridColor },
        ticks: {
          color: CHART_THEME.labelColor,
          font: { family: CHART_THEME.monoFontFamily, size: 10 },
          callback: (value) => `${value}`
        }
      }
    }
  };

  categoryChartType: 'doughnut' | 'bar' = 'doughnut';

  pieChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  pieChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: CHART_THEME.labelColor, font: { family: CHART_THEME.fontFamily, size: 11 }, boxWidth: 10, padding: 12 }
      }
    }
  };

  categoryBarChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  categoryBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: CHART_THEME.gridColor },
        ticks: {
          color: CHART_THEME.labelColor,
          font: { family: CHART_THEME.monoFontFamily, size: 10 }
        }
      },
      y: {
        grid: { display: false },
        ticks: {
          color: CHART_THEME.labelColor,
          font: { family: CHART_THEME.fontFamily, size: 11 }
        }
      }
    }
  };

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleCategoryChart(): void {
    this.categoryChartType = this.categoryChartType === 'doughnut' ? 'bar' : 'doughnut';
  }

  changeYear(delta: number): void {
    this.selectedYear += delta;
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.analyticsService.getAnnualOverview(this.selectedYear).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.overview = data;
        this.buildBarChart(data);
        this.buildPieChart(data);
        this.buildCategoryBarChart(data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.overview = null;
        this.error = err.error?.message || 'Failed to load annual overview. Please try again.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private buildBarChart(data: AnnualOverview): void {
    this.barChartData = {
      labels: this.monthLabels,
      datasets: [
        {
          label: 'Income',
          data: data.monthlyBreakdown.map(m => m.income),
          backgroundColor: CHART_THEME.incomeColor,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Expenses',
          data: data.monthlyBreakdown.map(m => m.expenses),
          backgroundColor: CHART_THEME.expenseColor,
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    };
  }

  private getCategoryColors(data: AnnualOverview): string[] {
    return data.byCategory.map((c, i) => c.color || CHART_THEME.categoryColors[i % CHART_THEME.categoryColors.length]);
  }

  private buildPieChart(data: AnnualOverview): void {
    this.pieChartData = {
      labels: data.byCategory.map(c => c.category),
      datasets: [{
        data: data.byCategory.map(c => c.total),
        backgroundColor: this.getCategoryColors(data),
        borderColor: CHART_THEME.borderColor,
        borderWidth: 2,
      }]
    };
  }

  private buildCategoryBarChart(data: AnnualOverview): void {
    this.categoryBarChartData = {
      labels: data.byCategory.map(c => c.category),
      datasets: [{
        data: data.byCategory.map(c => c.total),
        backgroundColor: this.getCategoryColors(data),
        borderRadius: 4,
        borderSkipped: false,
      }]
    };
  }
}
