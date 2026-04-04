import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { UserManagementComponent } from './user-management.component';
import { AdminUsersService, AdminUserDto, UserRole } from '../../api/generated';
import { AuthStateService } from '../../core/auth-state.service';

function createMockUsers(): AdminUserDto[] {
  return [
    { id: 'u1', username: 'admin', role: UserRole.Admin, enabled: true },
    { id: 'u2', username: 'user1', role: UserRole.User, enabled: true },
    { id: 'u3', username: 'disabled', role: UserRole.User, enabled: false },
  ];
}

describe('UserManagementComponent', () => {
  let component: UserManagementComponent;
  let fixture: ComponentFixture<UserManagementComponent>;
  let adminUsersService: jest.Mocked<AdminUsersService>;

  beforeEach(async () => {
    const adminUsersServiceMock = {
      listUsers: jest.fn().mockReturnValue(of(createMockUsers())),
      createUser: jest.fn(),
      updateUser: jest.fn(),
    };
    const authStateMock = {
      currentUser: { id: 'u1', username: 'admin', role: UserRole.Admin },
    };

    await TestBed.configureTestingModule({
      imports: [UserManagementComponent],
      providers: [
        { provide: AdminUsersService, useValue: adminUsersServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    adminUsersService = TestBed.inject(AdminUsersService) as jest.Mocked<AdminUsersService>;
    fixture = TestBed.createComponent(UserManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load users on init', () => {
    expect(adminUsersService.listUsers).toHaveBeenCalled();
    expect(component.users.length).toBe(3);
    expect(component.loading).toBe(false);
  });

  it('should set current user id', () => {
    expect(component.currentUserId).toBe('u1');
  });

  it('should render page header', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('User Management');
  });

  // ─── Sorting ───

  it('should sort users by username after load', () => {
    expect(component.users[0].username).toBe('admin');
    expect(component.users[1].username).toBe('disabled');
    expect(component.users[2].username).toBe('user1');
  });

  it('should sort users after creating a new user', () => {
    const newUser: AdminUserDto = { id: 'u4', username: 'bob', role: UserRole.User, enabled: true };
    adminUsersService.createUser.mockReturnValue(of(newUser));

    component.createUsername = 'bob';
    component.createPassword = 'password';
    component.onCreate();

    expect(component.users[0].username).toBe('admin');
    expect(component.users[1].username).toBe('bob');
    expect(component.users[2].username).toBe('disabled');
    expect(component.users[3].username).toBe('user1');
  });

  it('should sort users after editing a username', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    const updated = { ...user, username: 'aardvark' };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.startEditField(user, 'username');
    component.editValue = 'aardvark';
    component.saveFieldEdit(user);

    expect(component.users[0].username).toBe('aardvark');
    expect(component.users[1].username).toBe('admin');
  });

  // ─── Card Rendering ───

  it('should render user cards with usernames', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('admin');
    expect(el.textContent).toContain('user1');
    expect(el.textContent).toContain('disabled');
  });

  it('should display role labels', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Admin');
    expect(el.textContent).toContain('User');
  });

  it('should display status badges', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Active');
    expect(el.textContent).toContain('Disabled');
  });

  it('should show "You" badge for current user', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('You');
  });

  it('should render Set Password buttons', () => {
    const el: HTMLElement = fixture.nativeElement;
    const buttons = el.querySelectorAll('button');
    const setPasswordButtons = Array.from(buttons).filter(b => b.textContent?.trim() === 'Set Password');
    expect(setPasswordButtons.length).toBe(3);
  });

  // ─── Create User ───

  it('should toggle create form', () => {
    expect(component.showCreateForm).toBe(false);
    component.showCreateForm = true;
    component['cdr'].markForCheck();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Create New User');
  });

  it('should show error on empty create fields', () => {
    component.showCreateForm = true;
    component.onCreate();

    expect(component.createError).toBe('Please fill in all fields.');
    expect(adminUsersService.createUser).not.toHaveBeenCalled();
  });

  it('should create user and add to list', () => {
    const newUser: AdminUserDto = { id: 'u4', username: 'newuser', role: UserRole.User, enabled: true };
    adminUsersService.createUser.mockReturnValue(of(newUser));

    component.showCreateForm = true;
    component.createUsername = 'newuser';
    component.createPassword = 'password';
    component.createRole = UserRole.User;
    component.onCreate();

    expect(adminUsersService.createUser).toHaveBeenCalledWith({
      username: 'newuser',
      password: 'password',
      role: UserRole.User,
    });
    expect(component.users.length).toBe(4);
    expect(component.showCreateForm).toBe(false);
    expect(component.createLoading).toBe(false);
  });

  it('should show error on username conflict during create', () => {
    adminUsersService.createUser.mockReturnValue(throwError(() => ({ status: 409 })));

    component.createUsername = 'admin';
    component.createPassword = 'password';
    component.onCreate();

    expect(component.createError).toBe('Username is already taken.');
    expect(component.createLoading).toBe(false);
  });

  it('should show generic error on create failure', () => {
    adminUsersService.createUser.mockReturnValue(throwError(() => ({ status: 500 })));

    component.createUsername = 'newuser';
    component.createPassword = 'password';
    component.onCreate();

    expect(component.createError).toBe('Failed to create user.');
  });

  it('should reset create form fields after successful create', () => {
    const newUser: AdminUserDto = { id: 'u4', username: 'newuser', role: UserRole.User, enabled: true };
    adminUsersService.createUser.mockReturnValue(of(newUser));

    component.createUsername = 'newuser';
    component.createPassword = 'password';
    component.createRole = UserRole.Admin;
    component.onCreate();

    expect(component.createUsername).toBe('');
    expect(component.createPassword).toBe('');
    expect(component.createRole).toBe(UserRole.User);
  });

  // ─── Per-field Edit ───

  it('should start editing username field', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.startEditField(user, 'username');

    expect(component.editingField.get('u2')).toBe('username');
    expect(component.editValue).toBe('user1');
  });

  it('should start editing role field', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.startEditField(user, 'role');

    expect(component.editingField.get('u2')).toBe('role');
    expect(component.editValue).toBe(UserRole.User);
  });

  it('should cancel field editing', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.startEditField(user, 'username');
    component.cancelFieldEdit();

    expect(component.editingField.size).toBe(0);
    expect(component.editValue).toBe('');
  });

  it('should save username change', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    const updated = { ...user, username: 'renamed' };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.startEditField(user, 'username');
    component.editValue = 'renamed';
    component.saveFieldEdit(user);

    expect(adminUsersService.updateUser).toHaveBeenCalledWith('u2', { username: 'renamed' });
    expect(component.editingField.size).toBe(0);
  });

  it('should save role change', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    const updated = { ...user, role: UserRole.Admin };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.startEditField(user, 'role');
    component.editValue = UserRole.Admin;
    component.saveFieldEdit(user);

    expect(adminUsersService.updateUser).toHaveBeenCalledWith('u2', { role: UserRole.Admin });
  });

  it('should not call API when field value unchanged', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.startEditField(user, 'username');
    // editValue is already 'user1', don't change it
    component.saveFieldEdit(user);

    expect(adminUsersService.updateUser).not.toHaveBeenCalled();
    expect(component.editingField.size).toBe(0);
  });

  it('should cancel previous edit when starting a new one', () => {
    const user1 = component.users.find(u => u.id === 'u2')!;
    const user2 = component.users.find(u => u.id === 'u3')!;

    component.startEditField(user1, 'username');
    expect(component.editingField.get('u2')).toBe('username');

    component.startEditField(user2, 'role');
    expect(component.editingField.has('u2')).toBe(false);
    expect(component.editingField.get('u3')).toBe('role');
  });

  // ─── Per-card Errors ───

  it('should show per-card error on edit failure', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    adminUsersService.updateUser.mockReturnValue(throwError(() => ({ status: 500 })));

    component.startEditField(user, 'username');
    component.editValue = 'renamed';
    component.saveFieldEdit(user);

    expect(component.userErrors.get('u2')).toBe('Failed to update user.');
  });

  it('should show per-card error on username conflict during edit', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    adminUsersService.updateUser.mockReturnValue(throwError(() => ({ status: 409 })));

    component.startEditField(user, 'username');
    component.editValue = 'admin';
    component.saveFieldEdit(user);

    expect(component.userErrors.get('u2')).toBe('Username is already taken.');
  });

  it('should show per-card error on toggle failure', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    adminUsersService.updateUser.mockReturnValue(throwError(() => ({ status: 500 })));

    component.toggleEnabled(user);

    expect(component.userErrors.get('u2')).toBe('Failed to update user.');
  });

  it('should clear per-card error before new operation', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.userErrors.set('u2', 'Old error');

    const updated = { ...user, enabled: false };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.toggleEnabled(user);

    expect(component.userErrors.has('u2')).toBe(false);
  });

  it('should render per-card error in template', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.userErrors.set(user.id, 'Something went wrong');
    component['cdr'].markForCheck();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Something went wrong');
  });

  // ─── Toggle Enabled ───

  it('should disable a user', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    const updated = { ...user, enabled: false };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.toggleEnabled(user);

    expect(adminUsersService.updateUser).toHaveBeenCalledWith('u2', { enabled: false });
    const updatedUser = component.users.find(u => u.id === 'u2')!;
    expect(updatedUser.enabled).toBe(false);
  });

  it('should enable a disabled user', () => {
    const user = component.users.find(u => u.id === 'u3')!;
    const updated = { ...user, enabled: true };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.toggleEnabled(user);

    expect(adminUsersService.updateUser).toHaveBeenCalledWith('u3', { enabled: true });
    const updatedUser = component.users.find(u => u.id === 'u3')!;
    expect(updatedUser.enabled).toBe(true);
  });

  it('should not toggle own account', () => {
    const currentUser = component.users.find(u => u.id === 'u1')!;
    component.toggleEnabled(currentUser);

    expect(adminUsersService.updateUser).not.toHaveBeenCalled();
  });

  // ─── Password ───

  it('should start password edit', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.startPasswordEdit(user);

    expect(component.passwordUserId).toBe('u2');
    expect(component.newPassword).toBe('');
  });

  it('should cancel password edit', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.startPasswordEdit(user);
    component.newPassword = 'secret';
    component.cancelPasswordEdit();

    expect(component.passwordUserId).toBeNull();
    expect(component.newPassword).toBe('');
  });

  it('should save password', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    adminUsersService.updateUser.mockReturnValue(of(user));

    component.startPasswordEdit(user);
    component.newPassword = 'newpass123';
    component.savePassword(user);

    expect(adminUsersService.updateUser).toHaveBeenCalledWith('u2', { password: 'newpass123' });
    expect(component.passwordUserId).toBeNull();
  });

  it('should not save empty password', () => {
    const user = component.users.find(u => u.id === 'u2')!;

    component.startPasswordEdit(user);
    component.savePassword(user);

    expect(adminUsersService.updateUser).not.toHaveBeenCalled();
  });

  it('should show per-card error on password save failure', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    adminUsersService.updateUser.mockReturnValue(throwError(() => ({ status: 500 })));

    component.startPasswordEdit(user);
    component.newPassword = 'newpass';
    component.savePassword(user);

    expect(component.userErrors.get('u2')).toBe('Failed to set password.');
  });

  it('should cancel field edit when starting password edit', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.startEditField(user, 'username');
    expect(component.editingField.size).toBe(1);

    component.startPasswordEdit(user);
    expect(component.editingField.size).toBe(0);
    expect(component.passwordUserId).toBe('u2');
  });

  it('should cancel password edit when starting field edit', () => {
    const user = component.users.find(u => u.id === 'u2')!;
    component.startPasswordEdit(user);
    expect(component.passwordUserId).toBe('u2');

    component.startEditField(user, 'username');
    expect(component.passwordUserId).toBeNull();
  });

  // ─── Error States ───

  it('should show error on users load failure', () => {
    adminUsersService.listUsers.mockReturnValue(throwError(() => new Error('fail')));

    component.loadUsers();

    expect(component.error).toBe('Failed to load users.');
    expect(component.loading).toBe(false);
  });

  it('should retry loading users', () => {
    adminUsersService.listUsers.mockReturnValue(throwError(() => new Error('fail')));
    component.loadUsers();
    expect(component.error).toBe('Failed to load users.');

    const freshUsers = createMockUsers();
    adminUsersService.listUsers.mockReturnValue(of(freshUsers));
    component.loadUsers();
    expect(component.users.length).toEqual(freshUsers.length);
    expect(component.error).toBe('');
  });
});
