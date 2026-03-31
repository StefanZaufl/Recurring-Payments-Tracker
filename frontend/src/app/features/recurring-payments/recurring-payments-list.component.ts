import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-recurring-payments-list',
  imports: [CommonModule],
  template: `
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Recurring Payments</h1>
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-gray-500">Recurring payments will appear here after CSV analysis.</p>
      </div>
    </div>
  `
})
export class RecurringPaymentsListComponent {}
