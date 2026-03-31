import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  template: `
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-gray-500">Upload a CSV file to see your annual overview and recurring payment analysis.</p>
      </div>
    </div>
  `
})
export class DashboardComponent {}
