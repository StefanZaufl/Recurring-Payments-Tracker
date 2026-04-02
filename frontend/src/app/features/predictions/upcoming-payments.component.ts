import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AnalyticsService } from '../../api/generated';
import { PredictionResponse } from '../../api/generated/model/predictionResponse';

@Component({
  selector: 'app-upcoming-payments',
  imports: [CommonModule, RouterLink, BaseChartDirective],
  template: `
    <div class="animate-fade-in">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Predictions</h1>
        <p class="text-sm text-muted mt-0.5">6-month payment forecast</p>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="flex flex-col items-center justify-center py-20 gap-3">
        <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
        <span class="text-sm text-muted">Generating predictions...</span>
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
      <div *ngIf="!loading && !error && !predictions" class="glass-card p-10 sm:p-16 text-center animate-slide-up">
        <div class="w-16 h-16 rounded-2xl bg-sky-dim flex items-center justify-center mx-auto mb-5">
          <svg class="w-7 h-7 text-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
        </div>
        <h3 class="text-base font-semibold text-white mb-1">No predictions available</h3>
        <p class="text-sm text-muted mb-5">Upload bank transactions to generate forecasts.</p>
        <a routerLink="/upload" class="btn-primary">Upload CSV</a>
      </div>

      <div *ngIf="!loading && predictions" class="animate-slide-up">
        <!-- Forecast chart -->
        <div class="glass-card p-4 sm:p-5 mb-5 sm:mb-6">
          <h2 class="text-sm font-semibold text-white mb-4">Monthly Forecast</h2>
          <div class="h-52 sm:h-72">
            <canvas baseChart
                    [datasets]="forecastChartData.datasets"
                    [labels]="forecastChartData.labels"
                    [options]="forecastChartOptions"
                    type="bar">
            </canvas>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <!-- Monthly predictions -->
          <div class="glass-card overflow-hidden">
            <div class="px-4 sm:px-5 py-4 border-b border-card-border">
              <h2 class="text-sm font-semibold text-white">Monthly Breakdown</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead>
                  <tr class="border-b border-card-border">
                    <th class="table-header">Month</th>
                    <th class="table-header text-right">Income</th>
                    <th class="table-header text-right">Expenses</th>
                    <th class="table-header text-right">Surplus</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-card-border">
                  <tr *ngFor="let pred of predictions.predictions" class="hover:bg-card-hover transition-colors">
                    <td class="table-cell font-medium text-white text-xs">{{ formatMonth(pred.month) }}</td>
                    <td class="table-cell text-right font-mono text-xs text-accent">{{ formatCurrency(pred.expectedIncome) }}</td>
                    <td class="table-cell text-right font-mono text-xs text-coral">{{ formatCurrency(pred.expectedExpenses) }}</td>
                    <td class="table-cell text-right font-mono text-xs font-medium"
                        [class.text-accent]="pred.expectedSurplus >= 0"
                        [class.text-coral]="pred.expectedSurplus < 0">
                      {{ formatCurrency(pred.expectedSurplus) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Upcoming payments -->
          <div class="glass-card overflow-hidden">
            <div class="px-4 sm:px-5 py-4 border-b border-card-border flex items-center justify-between">
              <h2 class="text-sm font-semibold text-white">Upcoming Payments</h2>
              <span class="text-xs text-muted font-mono">{{ predictions.upcomingPayments.length }}</span>
            </div>
            <div *ngIf="predictions.upcomingPayments.length === 0" class="p-6 text-center">
              <p class="text-sm text-muted">No upcoming payments predicted.</p>
            </div>
            <ul *ngIf="predictions.upcomingPayments.length > 0" class="divide-y divide-card-border max-h-[400px] overflow-y-auto">
              <li *ngFor="let payment of predictions.upcomingPayments"
                  class="px-4 sm:px-5 py-3 flex items-center justify-between hover:bg-card-hover transition-colors">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-white truncate">{{ payment.name }}</p>
                  <p class="text-[11px] text-muted font-mono mt-0.5">{{ formatDate(payment.date) }}</p>
                </div>
                <span class="font-mono text-xs font-medium shrink-0 ml-3"
                      [class.text-accent]="payment.amount > 0"
                      [class.text-coral]="payment.amount <= 0">
                  {{ formatCurrency(payment.amount) }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UpcomingPaymentsComponent implements OnInit {
  loading = false;
  error: string | null = null;
  predictions: PredictionResponse | null = null;

  forecastChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  forecastChartOptions: ChartConfiguration<'bar'>['options'] = {
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

  constructor(private analyticsService: AnalyticsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  formatMonth(month: string): string {
    const [year, m] = month.split('-');
    const date = new Date(Number(year), Number(m) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('de-AT', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.analyticsService.getPredictions(6).subscribe({
      next: (data) => {
        this.predictions = data;
        this.buildForecastChart(data);
        this.loading = false;
      },
      error: (err) => {
        this.predictions = null;
        this.error = err.error?.message || 'Failed to load predictions. Please try again.';
        this.loading = false;
      }
    });
  }

  private buildForecastChart(data: PredictionResponse): void {
    this.forecastChartData = {
      labels: data.predictions.map(p => this.formatMonth(p.month)),
      datasets: [
        {
          label: 'Expected Income',
          data: data.predictions.map(p => p.expectedIncome),
          backgroundColor: 'rgba(34,197,94,0.7)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Expected Expenses',
          data: data.predictions.map(p => p.expectedExpenses),
          backgroundColor: 'rgba(248,113,113,0.7)',
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    };
  }
}
