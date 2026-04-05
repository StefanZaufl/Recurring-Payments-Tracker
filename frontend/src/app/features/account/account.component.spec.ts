import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AccountComponent } from './account.component';
import { AccountService, CurrentUserResponse, UserRole } from '../../api/generated';
import { AuthStateService } from '../../core/auth-state.service';

describe('AccountComponent', () => {
  let component: AccountComponent;
  let fixture: ComponentFixture<AccountComponent>;
  let accountService: jest.Mocked<AccountService>;
  let authState: { currentUser: CurrentUserResponse | null; refreshUser: jest.Mock };

  beforeEach(async () => {
    const accountServiceMock = {
      changeUsername: jest.fn(),
      changePassword: jest.fn(),
    };
    authState = {
      currentUser: { id: 'u1', username: 'admin', role: UserRole.Admin },
      refreshUser: jest.fn().mockReturnValue(of(null)),
    };

    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        { provide: AccountService, useValue: accountServiceMock },
        { provide: AuthStateService, useValue: authState },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    accountService = TestBed.inject(AccountService) as jest.Mocked<AccountService>;
    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display current username on init', () => {
    expect(component.currentUsername).toBe('admin');
  });

  it('should render page header', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Account Settings');
  });

  // ─── Username ───

  it('should show error when new username is empty', () => {
    component.newUsername = '';
    component.onChangeUsername();

    expect(component.usernameError).toBe('Please enter a new username.');
    expect(accountService.changeUsername).not.toHaveBeenCalled();
  });

  it('should change username successfully', () => {
    accountService.changeUsername.mockReturnValue(of(undefined));

    component.newUsername = 'newadmin';
    component.onChangeUsername();

    expect(accountService.changeUsername).toHaveBeenCalledWith({ newUsername: 'newadmin' });
    expect(component.usernameSuccess).toBe('Username updated successfully.');
    expect(component.currentUsername).toBe('newadmin');
    expect(component.newUsername).toBe('');
    expect(component.usernameLoading).toBe(false);
    expect(authState.refreshUser).toHaveBeenCalled();
  });

  it('should show error on username conflict (409)', () => {
    accountService.changeUsername.mockReturnValue(throwError(() => ({ status: 409 })));

    component.newUsername = 'taken';
    component.onChangeUsername();

    expect(component.usernameError).toBe('Username is already taken.');
    expect(component.usernameLoading).toBe(false);
  });

  it('should show generic error on username change failure', () => {
    accountService.changeUsername.mockReturnValue(throwError(() => ({ status: 500 })));

    component.newUsername = 'new';
    component.onChangeUsername();

    expect(component.usernameError).toBe('Failed to update username.');
  });

  it('should display username success in template', () => {
    accountService.changeUsername.mockReturnValue(of(undefined));

    component.newUsername = 'newadmin';
    component.onChangeUsername();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Username updated successfully.');
  });

  // ─── Password ───

  it('should show error when password fields are empty', () => {
    component.onChangePassword();

    expect(component.passwordError).toBe('Please fill in all fields.');
    expect(accountService.changePassword).not.toHaveBeenCalled();
  });

  it('should show error when new passwords do not match', () => {
    component.currentPassword = 'old';
    component.newPassword = 'newpassword1';
    component.confirmNewPassword = 'newpassword2';
    component.onChangePassword();

    expect(component.passwordError).toBe('New passwords do not match.');
  });

  it('should show error when new password is too short', () => {
    component.currentPassword = 'old';
    component.newPassword = 'short';
    component.confirmNewPassword = 'short';
    component.onChangePassword();

    expect(component.passwordError).toBe('Password must be at least 8 characters.');
  });

  it('should change password successfully', () => {
    accountService.changePassword.mockReturnValue(of(undefined));

    component.currentPassword = 'oldpass';
    component.newPassword = 'newpassword';
    component.confirmNewPassword = 'newpassword';
    component.onChangePassword();

    expect(accountService.changePassword).toHaveBeenCalledWith({ currentPassword: 'oldpass', newPassword: 'newpassword' });
    expect(component.passwordSuccess).toBe('Password updated successfully.');
    expect(component.currentPassword).toBe('');
    expect(component.newPassword).toBe('');
    expect(component.confirmNewPassword).toBe('');
    expect(component.passwordLoading).toBe(false);
  });

  it('should show error on wrong current password (401)', () => {
    accountService.changePassword.mockReturnValue(throwError(() => ({ status: 401 })));

    component.currentPassword = 'wrong';
    component.newPassword = 'newpassword';
    component.confirmNewPassword = 'newpassword';
    component.onChangePassword();

    expect(component.passwordError).toBe('Current password is incorrect.');
    expect(component.passwordLoading).toBe(false);
  });

  it('should show generic error on password change failure', () => {
    accountService.changePassword.mockReturnValue(throwError(() => ({ status: 500 })));

    component.currentPassword = 'old';
    component.newPassword = 'newpassword';
    component.confirmNewPassword = 'newpassword';
    component.onChangePassword();

    expect(component.passwordError).toBe('Failed to update password.');
  });

  it('should clear previous messages on new attempt', () => {
    component.usernameSuccess = 'old success';
    component.usernameError = 'old error';

    accountService.changeUsername.mockReturnValue(of(undefined));
    component.newUsername = 'new';
    component.onChangeUsername();

    expect(component.usernameError).toBe('');
    expect(component.usernameSuccess).toBe('Username updated successfully.');
  });
});
