import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AnalyticsService } from '../../api/generated';
import { AnnualOverview } from '../../api/generated/model/annualOverview';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, BaseChartDirective],
  template: `
    <div class="animate-fade-in">
      <!-- Header row -->
      <div class="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p class="text-sm text-muted mt-0.5">Annual financial overview</p>
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <button (click)="changeYear(-1)"
                  class="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-card-border text-muted hover:text-white hover:border-subtle transition-all">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span class="px-4 py-2 text-sm font-mono font-semibold text-white bg-card border border-card-border rounded-xl min-w-[5.5rem] text-center">
            {{ selectedYear }}
          </span>
          <button (click)="changeYear(1)"
                  class="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-card-border text-muted hover:text-white hover:border-subtle transition-all">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="flex flex-col items-center justify-center py-20 gap-3">
        <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
        <span class="text-sm text-muted">Loading data...</span>
      </div>

      <!-- Error state -->
      <div *ngIf="!loading && error" class="glass-card p-6 border-coral/20 animate-slide-up">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-coral-dim flex items-center justify-center shrink-0 mt-0.5">
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
      <div *ngIf="!loading && !error && !overview" class="glass-card p-10 sm:p-16 text-center animate-slide-up">
        <div class="w-16 h-16 rounded-2xl bg-accent-dim flex items-center justify-center mx-auto mb-5">
          <svg class="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <h3 class="text-base font-semibold text-white mb-1">No data for {{ selectedYear }}</h3>
        <p class="text-sm text-muted mb-5">Upload a CSV to see your annual overview.</p>
        <a routerLink="/upload" class="btn-primary">Upload CSV</a>
      </div>

      <!-- Dashboard content -->
      <div *ngIf="!loading && overview" class="animate-slide-up">
        <!-- Summary cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div class="glass-card p-4 sm:p-5 min-w-0 group hover:border-accent/30 transition-colors">
            <p class="stat-label mb-2">Income</p>
            <p class="stat-value text-accent">{{ formatCurrency(overview.totalIncome) }}</p>
          </div>
          <div class="glass-card p-4 sm:p-5 min-w-0 group hover:border-coral/30 transition-colors">
            <p class="stat-label mb-2">Expenses</p>
            <p class="stat-value text-coral">{{ formatCurrency(overview.totalExpenses) }}</p>
          </div>
          <div class="glass-card p-4 sm:p-5 min-w-0 group hover:border-amber/30 transition-colors">
            <p class="stat-label mb-2">Recurring</p>
            <p class="stat-value text-amber">{{ formatCurrency(overview.totalRecurringExpenses) }}</p>
          </div>
          <div class="glass-card p-4 sm:p-5 min-w-0 group transition-colors">
            <p class="stat-label mb-2">Surplus</p>
            <p class="stat-value"
               [class.text-accent]="overview.totalIncome - overview.totalExpenses >= 0"
               [class.text-coral]="overview.totalIncome - overview.totalExpenses < 0">
              {{ formatCurrency(overview.totalIncome - overview.totalExpenses) }}
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
                      [datasets]="barChartData.datasets"
                      [labels]="barChartData.labels"
                      [options]="barChartOptions"
                      type="bar">
              </canvas>
            </div>
          </div>

          <!-- Category doughnut -->
          <div class="glass-card p-4 sm:p-5">
            <h2 class="text-sm font-semibold text-white mb-4">By Category</h2>
            <div *ngIf="overview.byCategory.length > 0" class="h-56 sm:h-72 flex items-center justify-center">
              <canvas baseChart
                      [datasets]="pieChartData.datasets"
                      [labels]="pieChartData.labels"
                      [options]="pieChartOptions"
                      type="doughnut">
              </canvas>
            </div>
            <div *ngIf="overview.byCategory.length === 0" class="h-56 sm:h-72 flex items-center justify-center">
              <p class="text-sm text-muted text-center">No categorized<br>recurring payments yet.</p>
            </div>
          </div>
        </div>

        <!-- Recurring payments table -->
        <div class="glass-card overflow-hidden">
          <div class="px-4 sm:px-5 py-4 border-b border-card-border flex items-center justify-between">
            <h2 class="text-sm font-semibold text-white">Recurring Payments</h2>
            <span class="text-xs text-muted font-mono">{{ overview.recurringPayments.length }} items</span>
          </div>
          <div *ngIf="overview.recurringPayments.length === 0" class="p-6 text-center">
            <p class="text-sm text-muted">No recurring payments detected for this year.</p>
          </div>
          <div *ngIf="overview.recurringPayments.length > 0" class="overflow-x-auto">
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
                <tr *ngFor="let payment of overview.recurringPayments"
                    class="hover:bg-card-hover transition-colors">
                  <td class="table-cell font-medium text-white">{{ payment.name }}</td>
                  <td class="table-cell">
                    <span class="badge bg-subtle text-muted">{{ payment.category }}</span>
                  </td>
                  <td class="table-cell text-right font-mono text-coral text-xs">{{ formatCurrency(payment.monthlyAmount) }}</td>
                  <td class="table-cell text-right font-mono text-coral text-xs">{{ formatCurrency(payment.annualAmount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
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
        labels: { color: '#6b7194', font: { family: 'DM Sans', size: 11 }, boxWidth: 10, padding: 16 }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(42,45,62,0.5)' },
        ticks: { color: '#6b7194', font: { family: 'DM Sans', size: 10 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(42,45,62,0.5)' },
        ticks: {
          color: '#6b7194',
          font: { family: 'JetBrains Mono', size: 10 },
          callback: (value) => `${value}`
        }
      }
    }
  };

  pieChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  pieChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#6b7194', font: { family: 'DM Sans', size: 11 }, boxWidth: 10, padding: 12 }
      }
    }
  };

  private readonly categoryColors = [
    '#22c55e', '#f87171', '#38bdf8', '#fbbf24', '#a78bfa',
    '#f472b6', '#06b6d4', '#84cc16', '#fb923c', '#818cf8'
  ];

  constructor(private analyticsService: AnalyticsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  changeYear(delta: number): void {
    this.selectedYear += delta;
    this.loadData();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.analyticsService.getAnnualOverview(this.selectedYear).subscribe({
      next: (data) => {
        this.overview = data;
        this.buildBarChart(data);
        this.buildPieChart(data);
        this.loading = false;
      },
      error: (err) => {
        this.overview = null;
        this.error = err.error?.message || 'Failed to load annual overview. Please try again.';
        this.loading = false;
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
          backgroundColor: 'rgba(34,197,94,0.7)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Expenses',
          data: data.monthlyBreakdown.map(m => m.expenses),
          backgroundColor: 'rgba(248,113,113,0.7)',
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    };
  }

  private buildPieChart(data: AnnualOverview): void {
    this.pieChartData = {
      labels: data.byCategory.map(c => c.category),
      datasets: [{
        data: data.byCategory.map(c => c.total),
        backgroundColor: data.byCategory.map((_, i) => this.categoryColors[i % this.categoryColors.length]),
        borderColor: '#181a23',
        borderWidth: 2,
      }]
    };
  }
}
