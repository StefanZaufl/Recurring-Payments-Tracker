import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { AdminUsersService, AdminUserDto, UserRole } from '../../api/generated';
import { AuthStateService } from '../../core/auth-state.service';
import { Subject, takeUntil } from 'rxjs';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { EditableFieldComponent } from '../../shared/editable-field.component';

@Component({
  selector: 'app-user-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LoadingSpinnerComponent, ErrorStateComponent, EditableFieldComponent],
  template: `
    <div class="animate-fade-in">
      <div class="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p class="text-sm text-muted mt-0.5">Manage user accounts and permissions</p>
        </div>
        <button (click)="showCreateForm = !showCreateForm"
          class="btn-primary !px-3 !py-2 !text-xs sm:!px-5 sm:!py-2.5 sm:!text-sm">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span class="hidden sm:inline">Add User</span>
        </button>
      </div>
    
      <!-- Create User Form -->
      @if (showCreateForm) {
        <div class="glass-card p-6 mb-6 animate-slide-up">
          <h2 class="text-base font-semibold text-white mb-4">Create New User</h2>
          <form (ngSubmit)="onCreate()" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="createUsername" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Username</label>
                <input
                  id="createUsername"
                  type="text"
                  [(ngModel)]="createUsername"
                  name="createUsername"
                  required
                  class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                  placeholder="Enter username"
                  />
              </div>
              <div>
                <label for="createPassword" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Password</label>
                <input
                  id="createPassword"
                  type="password"
                  [(ngModel)]="createPassword"
                  name="createPassword"
                  autocomplete="new-password"
                  required
                  class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                  placeholder="Enter password"
                  />
              </div>
            </div>
            <div>
              <label for="createRole" class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Role</label>
              <select
                id="createRole"
                [(ngModel)]="createRole"
                name="createRole"
                class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                >
                <option [value]="UserRole.User">User</option>
                <option [value]="UserRole.Admin">Admin</option>
              </select>
            </div>
            @if (createError) {
              <div class="flex items-center gap-2 px-3 py-2.5 bg-coral-dim/50 border border-coral/20 rounded-xl">
                <svg class="w-4 h-4 text-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span class="text-xs text-coral">{{ createError }}</span>
              </div>
            }
            <div class="flex gap-3">
              <button type="submit" [disabled]="createLoading" class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                {{ createLoading ? 'Creating...' : 'Create User' }}
              </button>
              <button type="button" (click)="showCreateForm = false; createError = ''"
                class="px-5 py-2.5 text-sm font-medium text-muted hover:text-white border border-card-border rounded-xl hover:border-subtle transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      }
    
      <!-- Loading -->
      @if (loading) {
        <app-loading-spinner message="Loading users..." />
      }

      <!-- Global Error (load failure) -->
      @if (error) {
        <app-error-state [message]="error" (retry)="loadUsers()" />
      }
    
      <!-- User Cards -->
      @if (!loading) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (user of users; track user.id) {
            <div class="glass-card p-5 flex flex-col gap-3 animate-fade-in">
              <!-- Card Header: Username -->
              <div class="flex items-center justify-between gap-2 min-h-[2rem]">
                <app-editable-field
                  [editing]="editingField.get(user.id) === 'username'"
                  label="username"
                  (startEdit)="startEditField(user, 'username')"
                  (save)="saveFieldEdit(user)"
                  (cancelEdit)="cancelFieldEdit()">
                  <h3 display class="text-lg font-semibold text-white truncate">{{ user.username }}</h3>
                  <input editor
                    type="text"
                    [(ngModel)]="editValue"
                    class="flex-1 min-w-0 px-3 py-1.5 bg-surface border border-card-border rounded-lg text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
                    (keydown.enter)="saveFieldEdit(user)"
                    (keydown.escape)="cancelFieldEdit()"
                    />
                </app-editable-field>
                @if (user.id === currentUserId) {
                  <span class="badge bg-accent-dim text-accent shrink-0">You</span>
                }
              </div>
              <!-- Card Body -->
              <div class="flex flex-col gap-2.5">
                <!-- Role -->
                <div class="flex items-center justify-between min-h-[1.75rem]">
                  <span class="text-xs font-medium text-muted uppercase tracking-wider">Role</span>
                  <app-editable-field
                    [editing]="editingField.get(user.id) === 'role'"
                    label="role"
                    (startEdit)="startEditField(user, 'role')"
                    (save)="saveFieldEdit(user)"
                    (cancelEdit)="cancelFieldEdit()">
                    <span display class="badge" [class]="user.role === UserRole.Admin ? 'bg-amber-500/10 text-amber-400' : 'bg-sky-500/10 text-sky-400'">
                      @if (user.role === UserRole.Admin) {
                        <svg class="w-3 h-3 mr-0.5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                      }
                      {{ user.role === UserRole.Admin ? 'Admin' : 'User' }}
                    </span>
                    <select editor
                      [(ngModel)]="editValue"
                      class="px-3 py-1 bg-surface border border-card-border rounded-lg text-xs text-white focus:outline-none focus:border-accent/50 transition-colors">
                      <option [value]="UserRole.User">User</option>
                      <option [value]="UserRole.Admin">Admin</option>
                    </select>
                  </app-editable-field>
                </div>
                <!-- Status -->
                <div class="flex items-center justify-between min-h-[1.75rem]">
                  <span class="text-xs font-medium text-muted uppercase tracking-wider">Status</span>
                  @if (user.id !== currentUserId) {
                    <button
                      (click)="toggleEnabled(user)"
                      class="badge cursor-pointer transition-all hover:brightness-125"
                      [class]="user.enabled ? 'bg-accent-dim text-accent' : 'bg-coral-dim text-coral'">
                      <span class="inline-block w-1.5 h-1.5 rounded-full mr-1" [class.bg-accent]="user.enabled" [class.bg-coral]="!user.enabled"></span>{{ user.enabled ? 'Active' : 'Disabled' }}
                    </button>
                  }
                  @if (user.id === currentUserId) {
                    <span
                      class="badge bg-accent-dim text-accent opacity-60 cursor-not-allowed"
                      title="You cannot disable your own account">
                      <span class="inline-block w-1.5 h-1.5 rounded-full mr-1 bg-accent"></span>{{ user.enabled ? 'Active' : 'Disabled' }}
                    </span>
                  }
                </div>
                <!-- Password -->
                <div class="flex items-center justify-between min-h-[1.75rem]">
                  <span class="text-xs font-medium text-muted uppercase tracking-wider">Password</span>
                  @if (passwordUserId !== user.id) {
                    <div>
                      <button (click)="startPasswordEdit(user)"
                        class="text-xs font-medium text-muted hover:text-white border border-card-border rounded-lg px-3 py-1 hover:border-subtle transition-all">
                        Set Password
                      </button>
                    </div>
                  }
                  @if (passwordUserId === user.id) {
                    <app-editable-field
                      [editing]="true"
                      label="password"
                      (save)="savePassword(user)"
                      (cancelEdit)="cancelPasswordEdit()">
                      <input editor
                        type="password"
                        [(ngModel)]="newPassword"
                        autocomplete="new-password"
                        placeholder="New password"
                        class="w-28 px-3 py-1 bg-surface border border-card-border rounded-lg text-xs text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
                        (keydown.enter)="savePassword(user)"
                        (keydown.escape)="cancelPasswordEdit()"
                        />
                    </app-editable-field>
                  }
                </div>
              </div>
              <!-- Per-card Error -->
              @if (userErrors.get(user.id)) {
                <div class="flex items-center gap-2 px-3 py-2 bg-coral-dim/50 border border-coral/20 rounded-xl mt-1">
                  <svg class="w-3.5 h-3.5 text-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span class="text-xs text-coral">{{ userErrors.get(user.id) }}</span>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
    `
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private adminUsersService = inject(AdminUsersService);
  private authState = inject(AuthStateService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  readonly UserRole = UserRole;

  users: AdminUserDto[] = [];
  loading = true;
  error = '';
  currentUserId = '';

  showCreateForm = false;
  createUsername = '';
  createPassword = '';
  createRole: UserRole = UserRole.User;
  createError = '';
  createLoading = false;

  editingField = new Map<string, string>();
  editValue = '';
  userErrors = new Map<string, string>();

  passwordUserId: string | null = null;
  newPassword = '';

  ngOnInit(): void {
    this.currentUserId = this.authState.currentUser?.id ?? '';
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.adminUsersService.listUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (users) => {
        this.users = users;
        this.sortUsers();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Failed to load users.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onCreate(): void {
    if (!this.createUsername || !this.createPassword) {
      this.createError = 'Please fill in all fields.';
      return;
    }

    this.createLoading = true;
    this.createError = '';

    this.adminUsersService.createUser({
      username: this.createUsername,
      password: this.createPassword,
      role: this.createRole
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (user) => {
        this.users.push(user);
        this.sortUsers();
        this.createLoading = false;
        this.showCreateForm = false;
        this.createUsername = '';
        this.createPassword = '';
        this.createRole = UserRole.User;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.createLoading = false;
        if (err.status === 409) {
          this.createError = 'Username is already taken.';
        } else {
          this.createError = 'Failed to create user.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  startEditField(user: AdminUserDto, field: string): void {
    this.cancelFieldEdit();
    this.cancelPasswordEdit();
    this.editingField.set(user.id, field);
    if (field === 'username') {
      this.editValue = user.username;
    } else if (field === 'role') {
      this.editValue = user.role;
    }
  }

  cancelFieldEdit(): void {
    this.editingField.clear();
    this.editValue = '';
  }

  saveFieldEdit(user: AdminUserDto): void {
    const field = this.editingField.get(user.id);
    if (!field) return;

    const updates: Record<string, string | boolean> = {};
    if (field === 'username' && this.editValue !== user.username) {
      updates['username'] = this.editValue;
    } else if (field === 'role' && this.editValue !== user.role) {
      updates['role'] = this.editValue;
    }

    if (Object.keys(updates).length === 0) {
      this.cancelFieldEdit();
      return;
    }

    this.userErrors.delete(user.id);
    this.adminUsersService.updateUser(user.id, updates).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === updated.id);
        if (idx >= 0) this.users[idx] = updated;
        this.sortUsers();
        this.cancelFieldEdit();
        this.cdr.markForCheck();
      },
      error: (err) => {
        if (err.status === 409) {
          this.userErrors.set(user.id, 'Username is already taken.');
        } else {
          this.userErrors.set(user.id, 'Failed to update user.');
        }
        this.cancelFieldEdit();
        this.cdr.markForCheck();
      }
    });
  }

  toggleEnabled(user: AdminUserDto): void {
    if (user.id === this.currentUserId) return;

    this.userErrors.delete(user.id);
    this.adminUsersService.updateUser(user.id, { enabled: !user.enabled }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === updated.id);
        if (idx >= 0) this.users[idx] = updated;
        this.cdr.markForCheck();
      },
      error: () => {
        this.userErrors.set(user.id, 'Failed to update user.');
        this.cdr.markForCheck();
      }
    });
  }

  startPasswordEdit(user: AdminUserDto): void {
    this.cancelFieldEdit();
    this.passwordUserId = user.id;
    this.newPassword = '';
  }

  cancelPasswordEdit(): void {
    this.passwordUserId = null;
    this.newPassword = '';
  }

  savePassword(user: AdminUserDto): void {
    if (!this.newPassword) return;

    this.userErrors.delete(user.id);
    this.adminUsersService.updateUser(user.id, { password: this.newPassword }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.cancelPasswordEdit();
        this.cdr.markForCheck();
      },
      error: () => {
        this.userErrors.set(user.id, 'Failed to set password.');
        this.cdr.markForCheck();
      }
    });
  }

  private sortUsers(): void {
    this.users.sort((a, b) => a.username.localeCompare(b.username));
  }
}
