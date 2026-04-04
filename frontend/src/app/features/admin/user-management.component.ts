import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminUsersService, AdminUserDto, UserRole } from '../../api/generated';
import { AuthStateService } from '../../core/auth-state.service';

@Component({
  selector: 'app-user-management',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-in">
      <div class="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p class="text-sm text-muted mt-0.5">Manage user accounts and permissions</p>
        </div>
        <button (click)="showCreateForm = !showCreateForm" class="btn-primary">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add User
        </button>
      </div>

      <!-- Create User Form -->
      <div *ngIf="showCreateForm" class="glass-card p-6 mb-6 animate-slide-up">
        <h2 class="text-base font-semibold text-white mb-4">Create New User</h2>
        <form (ngSubmit)="onCreate()" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Username</label>
              <input
                type="text"
                [(ngModel)]="createUsername"
                name="createUsername"
                required
                class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Password</label>
              <input
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
            <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Role</label>
            <select
              [(ngModel)]="createRole"
              name="createRole"
              class="w-full px-4 py-2.5 bg-surface border border-card-border rounded-xl text-sm text-white focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
            >
              <option [value]="UserRole.User">User</option>
              <option [value]="UserRole.Admin">Admin</option>
            </select>
          </div>

          <div *ngIf="createError" class="flex items-center gap-2 px-3 py-2.5 bg-coral-dim/50 border border-coral/20 rounded-xl">
            <svg class="w-4 h-4 text-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span class="text-xs text-coral">{{ createError }}</span>
          </div>

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

      <!-- Loading -->
      <div *ngIf="loading" class="flex flex-col items-center justify-center py-20 gap-3">
        <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
        <span class="text-sm text-muted">Loading users...</span>
      </div>

      <!-- User Table -->
      <div *ngIf="!loading" class="glass-card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-card-border">
                <th class="table-header">Username</th>
                <th class="table-header">Role</th>
                <th class="table-header">Status</th>
                <th class="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let user of users" class="border-b border-card-border/50 last:border-0 hover:bg-card-hover/30 transition-colors">
                <td class="table-cell">
                  <span class="text-white font-medium">{{ user.username }}</span>
                  <span *ngIf="user.id === currentUserId" class="ml-2 badge bg-accent-dim text-accent">You</span>
                </td>
                <td class="table-cell">
                  <span class="badge" [class]="user.role === UserRole.Admin ? 'bg-amber-500/10 text-amber-400' : 'bg-sky-500/10 text-sky-400'">
                    {{ user.role }}
                  </span>
                </td>
                <td class="table-cell">
                  <span class="badge" [class]="user.enabled ? 'bg-accent-dim text-accent' : 'bg-coral-dim text-coral'">
                    {{ user.enabled ? 'Active' : 'Disabled' }}
                  </span>
                </td>
                <td class="table-cell text-right">
                  <div *ngIf="editingUser?.id !== user.id" class="flex items-center justify-end gap-2">
                    <button (click)="startEdit(user)"
                            class="px-3 py-1.5 text-xs font-medium text-muted hover:text-white border border-card-border rounded-lg hover:border-subtle transition-all">
                      Edit
                    </button>
                    <button *ngIf="user.id !== currentUserId"
                            (click)="toggleEnabled(user)"
                            class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all"
                            [class]="user.enabled ? 'text-coral border-coral/30 hover:bg-coral-dim' : 'text-accent border-accent/30 hover:bg-accent-dim'">
                      {{ user.enabled ? 'Disable' : 'Enable' }}
                    </button>
                  </div>

                  <!-- Inline edit -->
                  <div *ngIf="editingUser?.id === user.id" class="flex items-center justify-end gap-2">
                    <input
                      type="text"
                      [(ngModel)]="editUsername"
                      class="w-32 px-3 py-1.5 bg-surface border border-card-border rounded-lg text-xs text-white focus:outline-none focus:border-accent/50 transition-colors"
                      placeholder="Username"
                    />
                    <select
                      [(ngModel)]="editRole"
                      class="px-3 py-1.5 bg-surface border border-card-border rounded-lg text-xs text-white focus:outline-none focus:border-accent/50 transition-colors"
                    >
                      <option [value]="UserRole.User">User</option>
                      <option [value]="UserRole.Admin">Admin</option>
                    </select>
                    <button (click)="saveEdit()"
                            class="px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent-dim transition-all">
                      Save
                    </button>
                    <button (click)="cancelEdit()"
                            class="px-3 py-1.5 text-xs font-medium text-muted border border-card-border rounded-lg hover:border-subtle transition-all">
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Error -->
      <div *ngIf="error" class="glass-card p-6 border-coral/20 mt-6">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-coral shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p class="text-sm text-coral font-medium">{{ error }}</p>
            <button (click)="loadUsers()" class="mt-2 text-xs text-muted hover:text-white transition-colors">Try again</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UserManagementComponent implements OnInit {
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

  editingUser: AdminUserDto | null = null;
  editUsername = '';
  editRole: UserRole = UserRole.User;

  constructor(
    private adminUsersService: AdminUsersService,
    private authState: AuthStateService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authState.currentUser?.id ?? '';
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.adminUsersService.listUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load users.';
        this.loading = false;
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
    }).subscribe({
      next: (user) => {
        this.users.push(user);
        this.createLoading = false;
        this.showCreateForm = false;
        this.createUsername = '';
        this.createPassword = '';
        this.createRole = UserRole.User;
      },
      error: (err) => {
        this.createLoading = false;
        if (err.status === 409) {
          this.createError = 'Username is already taken.';
        } else {
          this.createError = 'Failed to create user.';
        }
      }
    });
  }

  startEdit(user: AdminUserDto): void {
    this.editingUser = user;
    this.editUsername = user.username;
    this.editRole = user.role;
  }

  cancelEdit(): void {
    this.editingUser = null;
  }

  saveEdit(): void {
    if (!this.editingUser) return;

    const updates: Record<string, string | boolean> = {};
    if (this.editUsername !== this.editingUser.username) {
      updates['username'] = this.editUsername;
    }
    if (this.editRole !== this.editingUser.role) {
      updates['role'] = this.editRole;
    }

    if (Object.keys(updates).length === 0) {
      this.editingUser = null;
      return;
    }

    this.adminUsersService.updateUser(this.editingUser.id, updates).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === updated.id);
        if (idx >= 0) this.users[idx] = updated;
        this.editingUser = null;
      },
      error: () => {
        this.error = 'Failed to update user.';
      }
    });
  }

  toggleEnabled(user: AdminUserDto): void {
    this.adminUsersService.updateUser(user.id, { enabled: !user.enabled }).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === updated.id);
        if (idx >= 0) this.users[idx] = updated;
      },
      error: () => {
        this.error = 'Failed to update user.';
      }
    });
  }
}
