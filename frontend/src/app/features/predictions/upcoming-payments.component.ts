import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-upcoming-payments',
  imports: [CommonModule],
  template: `
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Predictions</h1>
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-gray-500">Payment predictions will appear here after recurring patterns are detected.</p>
      </div>
    </div>
  `
})
export class UpcomingPaymentsComponent {}
