import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50">
      <nav class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center">
              <span class="text-xl font-bold text-gray-900">Recurring Payments Tracker</span>
            </div>
            <div class="flex items-center space-x-4">
              <a routerLink="/dashboard" routerLinkActive="text-blue-600 border-b-2 border-blue-600"
                 class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600">Dashboard</a>
              <a routerLink="/upload" routerLinkActive="text-blue-600 border-b-2 border-blue-600"
                 class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600">Upload CSV</a>
              <a routerLink="/recurring-payments" routerLinkActive="text-blue-600 border-b-2 border-blue-600"
                 class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600">Recurring</a>
              <a routerLink="/predictions" routerLinkActive="text-blue-600 border-b-2 border-blue-600"
                 class="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600">Predictions</a>
            </div>
          </div>
        </div>
      </nav>
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <router-outlet />
      </main>
    </div>
  `,
  styles: []
})
export class AppComponent {
  title = 'Recurring Payments Tracker';
}
