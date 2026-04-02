import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-surface flex flex-col md:flex-row">
      <!-- Desktop sidebar -->
      <aside class="hidden md:flex flex-col w-60 lg:w-64 border-r border-card-border bg-card/50 p-4 fixed inset-y-0 left-0 z-30">
        <div class="flex items-center gap-3 px-3 mb-8 mt-2">
          <div class="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center">
            <svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span class="text-sm font-bold text-white tracking-tight">Payments</span>
            <span class="block text-[10px] text-muted font-medium tracking-wider uppercase">Tracker</span>
          </div>
        </div>

        <nav class="flex flex-col gap-1 flex-1">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">
            <svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            </svg>
            Dashboard
          </a>
          <a routerLink="/upload" routerLinkActive="active" class="nav-link">
            <svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload CSV
          </a>
          <a routerLink="/recurring-payments" routerLinkActive="active" class="nav-link">
            <svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
            Recurring
          </a>
          <a routerLink="/predictions" routerLinkActive="active" class="nav-link">
            <svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            Predictions
          </a>
        </nav>

        <div class="px-3 py-3 mt-auto border-t border-card-border">
          <p class="text-[10px] text-muted/60 font-medium">Recurring Payments Tracker</p>
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 md:ml-60 lg:ml-64 pb-20 md:pb-0">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <router-outlet />
        </div>
      </main>

      <!-- Mobile bottom nav -->
      <nav class="md:hidden fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur-xl border-t border-card-border z-30 px-2 safe-bottom">
        <div class="flex justify-around">
          <a routerLink="/dashboard" routerLinkActive="active" class="mobile-nav-item">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            </svg>
            <span class="text-[10px] font-medium">Dashboard</span>
            <div class="mobile-nav-dot w-1 h-1 rounded-full bg-accent opacity-0 transition-opacity"></div>
          </a>
          <a routerLink="/upload" routerLinkActive="active" class="mobile-nav-item">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span class="text-[10px] font-medium">Upload</span>
            <div class="mobile-nav-dot w-1 h-1 rounded-full bg-accent opacity-0 transition-opacity"></div>
          </a>
          <a routerLink="/recurring-payments" routerLinkActive="active" class="mobile-nav-item">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
            <span class="text-[10px] font-medium">Recurring</span>
            <div class="mobile-nav-dot w-1 h-1 rounded-full bg-accent opacity-0 transition-opacity"></div>
          </a>
          <a routerLink="/predictions" routerLinkActive="active" class="mobile-nav-item">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            <span class="text-[10px] font-medium">Forecast</span>
            <div class="mobile-nav-dot w-1 h-1 rounded-full bg-accent opacity-0 transition-opacity"></div>
          </a>
        </div>
      </nav>
    </div>
  `,
  styles: [`
    .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
  `]
})
export class AppComponent {
  title = 'Recurring Payments Tracker';
}
