import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthStateService } from './core/auth-state.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-surface flex flex-col md:flex-row">
      <!-- Desktop sidebar -->
      @if (authState.currentUser) {
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
            @for (link of navLinks; track link.route) {
              <a [routerLink]="link.route" routerLinkActive="active" class="nav-link">
                <svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="link.icon" />
                  @if (link.icon2) {
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="link.icon2" />
                  }
                </svg>
                {{ link.label }}
              </a>
            }
            <!-- Admin link -->
            @if ((authState.isAdmin$ | async)) {
              <a routerLink="/admin/users" routerLinkActive="active" class="nav-link mt-4 pt-4 border-t border-card-border">
                <svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                Users
              </a>
            }
          </nav>
          <!-- User section -->
          <div class="px-3 py-3 mt-auto border-t border-card-border space-y-2">
            <a routerLink="/account" routerLinkActive="active" class="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors cursor-pointer">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {{ authState.currentUser?.username }}
            </a>
            <button (click)="logout()" class="flex items-center gap-2 text-xs text-muted hover:text-coral transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          </div>
        </aside>
      }
    
      <!-- Main content -->
      <main [class]="authState.currentUser ? 'flex-1 md:ml-60 lg:ml-64 pb-20 md:pb-0' : 'flex-1'">
        <div [class]="authState.currentUser ? 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8' : ''">
          <router-outlet />
        </div>
      </main>
    
      <!-- Mobile bottom nav -->
      @if (authState.currentUser) {
        <nav class="md:hidden fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur-xl border-t border-card-border z-30 px-2 safe-bottom">
          <div class="flex justify-around">
            @for (link of navLinks.slice(0, 4); track link.route) {
              <a [routerLink]="link.route" routerLinkActive="active" class="mobile-nav-item">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="link.icon" />
                </svg>
                <span class="text-[10px] font-medium">{{ link.mobileLabel || link.label }}</span>
                <div class="mobile-nav-dot w-1 h-1 rounded-full bg-accent opacity-0 transition-opacity"></div>
              </a>
            }
            <button (click)="toggleMobileMenu()" class="mobile-nav-item" [class.text-accent]="mobileMenuOpen">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              <span class="text-[10px] font-medium">More</span>
              <div class="mobile-nav-dot w-1 h-1 rounded-full bg-accent transition-opacity" [class.opacity-0]="!mobileMenuOpen" [class.opacity-100]="mobileMenuOpen"></div>
            </button>
          </div>
        </nav>
      }
    
      <!-- Mobile slide-out menu backdrop -->
      @if (authState.currentUser) {
        <div
          class="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          [class.opacity-100]="mobileMenuOpen"
          [class.opacity-0]="!mobileMenuOpen"
          [class.pointer-events-none]="!mobileMenuOpen"
          role="button"
          tabindex="0"
          aria-label="Close menu"
          (click)="closeMobileMenu()"
          (keydown.enter)="closeMobileMenu()">
        </div>
      }
    
      <!-- Mobile slide-out sidebar -->
      @if (authState.currentUser) {
        <aside
          class="md:hidden fixed inset-y-0 right-0 w-72 bg-card border-l border-card-border z-50 flex flex-col transition-transform duration-300 ease-out"
          [class.translate-x-0]="mobileMenuOpen"
          [class.translate-x-full]="!mobileMenuOpen">
          <!-- Header with close button -->
          <div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-card-border">
            <div class="flex items-center gap-3">
              <div class="w-7 h-7 rounded-lg bg-accent-dim flex items-center justify-center">
                <svg class="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span class="text-sm font-bold text-white tracking-tight">Menu</span>
            </div>
            <button (click)="closeMobileMenu()" class="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-white hover:bg-card-hover transition-all">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Navigation links -->
          <nav class="flex flex-col gap-1 flex-1 p-4 overflow-y-auto">
            @for (link of navLinks; track link.route) {
              <a [routerLink]="link.route" routerLinkActive="active" (click)="closeMobileMenu()" class="nav-link">
                <svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="link.icon" />
                  @if (link.icon2) {
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="link.icon2" />
                  }
                </svg>
                {{ link.label }}
              </a>
            }
            <!-- Admin link -->
            @if ((authState.isAdmin$ | async)) {
              <a routerLink="/admin/users" routerLinkActive="active" (click)="closeMobileMenu()" class="nav-link mt-4 pt-4 border-t border-card-border">
                <svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                Users
              </a>
            }
          </nav>
          <!-- User section -->
          <div class="px-5 py-4 mt-auto border-t border-card-border space-y-3">
            <a routerLink="/account" routerLinkActive="active" (click)="closeMobileMenu()" class="flex items-center gap-2.5 text-sm text-muted hover:text-white transition-colors cursor-pointer">
              <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {{ authState.currentUser?.username }}
            </a>
            <button (click)="logout(); closeMobileMenu()" class="flex items-center gap-2.5 text-sm text-muted hover:text-coral transition-colors">
              <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          </div>
        </aside>
      }
    </div>
    `,
  styles: [`
    .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
  `]
})
export class AppComponent {
  authState = inject(AuthStateService);
  private router = inject(Router);

  title = 'Recurring Payments Tracker';
  mobileMenuOpen = false;

  navLinks = [
    { route: '/dashboard', label: 'Dashboard', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5' },
    { route: '/transactions', label: 'Transactions', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
    { route: '/recurring-payments', label: 'Recurring', icon: 'M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3' },
    { route: '/predictions', label: 'Predictions', mobileLabel: 'Forecast', icon: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941' },
    { route: '/configure', label: 'Configure', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z', icon2: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.mobileMenuOpen = false);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }

  logout(): void {
    this.authState.logout().subscribe();
  }
}
