import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../core/auth-state.service';
import { AccountService } from '../../api/generated';

@Component({
  selector: 'app-account',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-in">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Account Settings</h1>
        <p class="text-sm text-muted mt-0.5">Manage your profile and security</p>
      </div>

      <div class="grid gap-6 max-w-lg">
        <!-- Change Username -->
        <div class="glass-card p-6">
          <h2 class="text-base font-semibold text-white mb-4">Change Username</h2>
          <form (ngSubmit)="onChangeUsername()" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Current Username</label>
              <p class="text-sm text-white px-1">{{ currentUsername }}</p>
            </div>
            <div>
              <label for="newUsername" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">New Username</label>
              <input
                id="newUsername"
                type="text"
                [(ngModel)]="newUsername"
                name="newUsername"
                required
                class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                placeholder="Enter new username"
              />
            </div>
            <div *ngIf="usernameError" class="flex items-center gap-2 px-3 py-2.5 bg-coral-dim/50 border border-coral/20 rounded-xl">
              <svg class="w-4 h-4 text-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span class="text-xs text-coral">{{ usernameError }}</span>
            </div>
            <div *ngIf="usernameSuccess" class="flex items-center gap-2 px-3 py-2.5 bg-accent-dim/50 border border-accent/20 rounded-xl">
              <svg class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-xs text-accent">{{ usernameSuccess }}</span>
            </div>
            <button type="submit" [disabled]="usernameLoading" class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {{ usernameLoading ? 'Updating...' : 'Update Username' }}
            </button>
          </form>
        </div>

        <!-- Change Password -->
        <div class="glass-card p-6">
          <h2 class="text-base font-semibold text-white mb-4">Change Password</h2>
          <form (ngSubmit)="onChangePassword()" class="space-y-4">
            <div>
              <label for="currentPassword" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                [(ngModel)]="currentPassword"
                name="currentPassword"
                autocomplete="current-password"
                required
                class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label for="newPassword" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">New Password</label>
              <input
                id="newPassword"
                type="password"
                [(ngModel)]="newPassword"
                name="newPassword"
                autocomplete="new-password"
                required
                class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label for="confirmNewPassword" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Confirm New Password</label>
              <input
                id="confirmNewPassword"
                type="password"
                [(ngModel)]="confirmNewPassword"
                name="confirmNewPassword"
                autocomplete="new-password"
                required
                class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                placeholder="Confirm new password"
              />
            </div>
            <div *ngIf="passwordError" class="flex items-center gap-2 px-3 py-2.5 bg-coral-dim/50 border border-coral/20 rounded-xl">
              <svg class="w-4 h-4 text-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span class="text-xs text-coral">{{ passwordError }}</span>
            </div>
            <div *ngIf="passwordSuccess" class="flex items-center gap-2 px-3 py-2.5 bg-accent-dim/50 border border-accent/20 rounded-xl">
              <svg class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-xs text-accent">{{ passwordSuccess }}</span>
            </div>
            <button type="submit" [disabled]="passwordLoading" class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {{ passwordLoading ? 'Updating...' : 'Update Password' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `
})
export class AccountComponent implements OnInit {
  currentUsername = '';
  newUsername = '';
  usernameError = '';
  usernameSuccess = '';
  usernameLoading = false;

  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  passwordError = '';
  passwordSuccess = '';
  passwordLoading = false;

  constructor(
    private authState: AuthStateService,
    private accountService: AccountService
  ) {}

  ngOnInit(): void {
    this.currentUsername = this.authState.currentUser?.username ?? '';
  }

  onChangeUsername(): void {
    if (!this.newUsername) {
      this.usernameError = 'Please enter a new username.';
      return;
    }

    this.usernameLoading = true;
    this.usernameError = '';
    this.usernameSuccess = '';

    this.accountService.changeUsername({ newUsername: this.newUsername }).subscribe({
      next: () => {
        this.usernameLoading = false;
        this.usernameSuccess = 'Username updated successfully.';
        this.currentUsername = this.newUsername;
        this.newUsername = '';
        this.authState.refreshUser().subscribe();
      },
      error: (err) => {
        this.usernameLoading = false;
        if (err.status === 409) {
          this.usernameError = 'Username is already taken.';
        } else {
          this.usernameError = 'Failed to update username.';
        }
      }
    });
  }

  onChangePassword(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmNewPassword) {
      this.passwordError = 'Please fill in all fields.';
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordError = 'New passwords do not match.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.passwordError = 'Password must be at least 8 characters.';
      return;
    }

    this.passwordLoading = true;
    this.passwordError = '';
    this.passwordSuccess = '';

    this.accountService.changePassword({ currentPassword: this.currentPassword, newPassword: this.newPassword }).subscribe({
      next: () => {
        this.passwordLoading = false;
        this.passwordSuccess = 'Password updated successfully.';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmNewPassword = '';
      },
      error: (err) => {
        this.passwordLoading = false;
        if (err.status === 401) {
          this.passwordError = 'Current password is incorrect.';
        } else {
          this.passwordError = 'Failed to update password.';
        }
      }
    });
  }
}
