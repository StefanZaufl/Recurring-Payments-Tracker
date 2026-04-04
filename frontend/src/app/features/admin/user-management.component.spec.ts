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
    expect(component.users).toEqual(createMockUsers());
    expect(component.loading).toBe(false);
  });

  it('should set current user id', () => {
    expect(component.currentUserId).toBe('u1');
  });

  it('should render page header', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('User Management');
  });

  it('should render user table with usernames', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('admin');
    expect(el.textContent).toContain('user1');
    expect(el.textContent).toContain('disabled');
  });

  it('should display role badges', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('ADMIN');
    expect(el.textContent).toContain('USER');
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

  // ─── Create User ───

  it('should toggle create form', () => {
    expect(component.showCreateForm).toBe(false);
    component.showCreateForm = true;
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
    expect(component.users[3]).toEqual(newUser);
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

  // ─── Edit User ───

  it('should start editing a user', () => {
    const user = component.users[1];
    component.startEdit(user);

    expect(component.editingUser).toBe(user);
    expect(component.editUsername).toBe('user1');
    expect(component.editRole).toBe(UserRole.User);
  });

  it('should cancel editing', () => {
    component.startEdit(component.users[1]);
    component.cancelEdit();

    expect(component.editingUser).toBeNull();
  });

  it('should save edited user', () => {
    const updated = { ...component.users[1], username: 'renamed' };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.startEdit(component.users[1]);
    component.editUsername = 'renamed';
    component.saveEdit();

    expect(adminUsersService.updateUser).toHaveBeenCalledWith('u2', { username: 'renamed' });
    expect(component.users[1].username).toBe('renamed');
    expect(component.editingUser).toBeNull();
  });

  it('should save role change', () => {
    const updated = { ...component.users[1], role: UserRole.Admin };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.startEdit(component.users[1]);
    component.editRole = UserRole.Admin;
    component.saveEdit();

    expect(adminUsersService.updateUser).toHaveBeenCalledWith('u2', { role: UserRole.Admin });
  });

  it('should not call API when nothing changed', () => {
    component.startEdit(component.users[1]);
    component.saveEdit();

    expect(adminUsersService.updateUser).not.toHaveBeenCalled();
    expect(component.editingUser).toBeNull();
  });

  it('should show error on edit failure', () => {
    adminUsersService.updateUser.mockReturnValue(throwError(() => ({ status: 500 })));

    component.startEdit(component.users[1]);
    component.editUsername = 'renamed';
    component.saveEdit();

    expect(component.error).toBe('Failed to update user.');
  });

  // ─── Toggle Enabled ───

  it('should disable a user', () => {
    const updated = { ...component.users[1], enabled: false };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.toggleEnabled(component.users[1]);

    expect(adminUsersService.updateUser).toHaveBeenCalledWith('u2', { enabled: false });
    expect(component.users[1].enabled).toBe(false);
  });

  it('should enable a disabled user', () => {
    const updated = { ...component.users[2], enabled: true };
    adminUsersService.updateUser.mockReturnValue(of(updated));

    component.toggleEnabled(component.users[2]);

    expect(adminUsersService.updateUser).toHaveBeenCalledWith('u3', { enabled: true });
    expect(component.users[2].enabled).toBe(true);
  });

  it('should show error on toggle failure', () => {
    adminUsersService.updateUser.mockReturnValue(throwError(() => ({ status: 500 })));

    component.toggleEnabled(component.users[1]);

    expect(component.error).toBe('Failed to update user.');
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
    expect(component.users).toEqual(freshUsers);
    expect(component.error).toBe('');
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
});
