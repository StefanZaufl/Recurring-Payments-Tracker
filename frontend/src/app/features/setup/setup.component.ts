import { Component, OnDestroy, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SetupService } from '../../api/generated';
import { AuthStateService } from '../../core/auth-state.service';
import { Subject, takeUntil } from 'rxjs';
import { PASSWORD_MIN_LENGTH } from '../../shared/constants';

@Component({
  selector: 'app-setup',
  imports: [FormsModule],
  template: `
    <div class="min-h-screen bg-surface flex items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <!-- Logo -->
        <div class="flex items-center justify-center gap-3 mb-8">
          <div class="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center">
            <svg class="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span class="text-lg font-bold text-white tracking-tight">Payments</span>
            <span class="block text-[10px] text-muted font-medium tracking-wider uppercase">Tracker</span>
          </div>
        </div>
    
        <!-- Setup card -->
        <div class="glass-card p-6 sm:p-8">
          <h1 class="text-xl font-bold text-white mb-1">Welcome</h1>
          <p class="text-sm text-muted mb-6">Create your admin account to get started.</p>
    
          <form (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label for="username" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Username</label>
              <input
                id="username"
                type="text"
                [(ngModel)]="username"
                name="username"
                autocomplete="username"
                required
                class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                placeholder="Choose a username"
                />
            </div>
    
            <div>
              <label for="password" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                [(ngModel)]="password"
                name="password"
                autocomplete="new-password"
                required
                class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                placeholder="Choose a password"
                />
            </div>
    
            <div>
              <label for="confirmPassword" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                [(ngModel)]="confirmPassword"
                name="confirmPassword"
                autocomplete="new-password"
                required
                class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                placeholder="Confirm your password"
                />
            </div>
    
            @if (error) {
              <div class="flex items-center gap-2 px-3 py-2.5 bg-coral-dim/50 border border-coral/20 rounded-xl">
                <svg class="w-4 h-4 text-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span class="text-xs text-coral">{{ error }}</span>
              </div>
            }
    
            <button
              type="submit"
              [disabled]="loading"
              class="w-full btn-primary justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
              @if (loading) {
                <div class="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin"></div>
              }
              {{ loading ? 'Creating account...' : 'Create admin account' }}
            </button>
          </form>
        </div>
      </div>
    </div>
    `
})
export class SetupComponent implements OnDestroy {
  private setupService = inject(SetupService);
  private authState = inject(AuthStateService);
  private router = inject(Router);

  private destroy$ = new Subject<void>();
  username = '';
  password = '';
  confirmPassword = '';
  error = '';
  loading = false;

  onSubmit(): void {
    if (!this.username || !this.password || !this.confirmPassword) {
      this.error = 'Please fill in all fields.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    if (this.password.length < PASSWORD_MIN_LENGTH) {
      this.error = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
      return;
    }

    this.loading = true;
    this.error = '';

    this.setupService.initializeSetup({ username: this.username, password: this.password }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (user) => {
        this.authState.setUser(user);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 409) {
          this.error = 'Setup has already been completed.';
        } else {
          this.error = 'An error occurred. Please try again.';
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
