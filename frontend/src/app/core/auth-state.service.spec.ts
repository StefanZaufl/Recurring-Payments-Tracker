import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { AuthService, SetupService, CurrentUserResponse, UserRole } from '../api/generated';

const mockUser: CurrentUserResponse = { id: 'u1', username: 'admin', role: UserRole.Admin };

describe('AuthStateService', () => {
  let service: AuthStateService;
  let authService: jest.Mocked<AuthService>;
  let setupService: jest.Mocked<SetupService>;
  let router: jest.Mocked<Router>;

  beforeEach(() => {
    const authServiceMock = {
      login: jest.fn(),
      logout: jest.fn(),
      getCurrentUser: jest.fn(),
    };
    const setupServiceMock = {
      getSetupStatus: jest.fn(),
    };
    const routerMock = {
      navigate: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        { provide: AuthService, useValue: authServiceMock },
        { provide: SetupService, useValue: setupServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    service = TestBed.inject(AuthStateService);
    authService = TestBed.inject(AuthService) as jest.Mocked<AuthService>;
    setupService = TestBed.inject(SetupService) as jest.Mocked<SetupService>;
    router = TestBed.inject(Router) as jest.Mocked<Router>;
  });

  it('should be created with null user', () => {
    expect(service).toBeTruthy();
    expect(service.currentUser).toBeNull();
  });

  it('should login and set current user', () => {
    authService.login.mockReturnValue(of(mockUser));

    let result: CurrentUserResponse | undefined;
    service.login('admin', 'pass').subscribe(u => result = u);

    expect(authService.login).toHaveBeenCalledWith({ username: 'admin', password: 'pass' });
    expect(result).toEqual(mockUser);
    expect(service.currentUser).toEqual(mockUser);
  });

  it('should emit isLoggedIn$ as true after login', (done) => {
    authService.login.mockReturnValue(of(mockUser));
    service.login('admin', 'pass').subscribe();

    service.isLoggedIn$.subscribe(val => {
      expect(val).toBe(true);
      done();
    });
  });

  it('should emit isAdmin$ as true for admin user', (done) => {
    authService.login.mockReturnValue(of(mockUser));
    service.login('admin', 'pass').subscribe();

    service.isAdmin$.subscribe(val => {
      expect(val).toBe(true);
      done();
    });
  });

  it('should emit isAdmin$ as false for regular user', (done) => {
    const regularUser = { ...mockUser, role: UserRole.User };
    authService.login.mockReturnValue(of(regularUser));
    service.login('user', 'pass').subscribe();

    service.isAdmin$.subscribe(val => {
      expect(val).toBe(false);
      done();
    });
  });

  it('should logout, clear user, and navigate to /login', () => {
    authService.login.mockReturnValue(of(mockUser));
    service.login('admin', 'pass').subscribe();
    expect(service.currentUser).toEqual(mockUser);

    authService.logout.mockReturnValue(of(undefined));
    service.logout().subscribe();

    expect(service.currentUser).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should clear user and navigate on logout error', () => {
    authService.login.mockReturnValue(of(mockUser));
    service.login('admin', 'pass').subscribe();

    authService.logout.mockReturnValue(throwError(() => new Error('fail')));
    service.logout().subscribe();

    expect(service.currentUser).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should check session and set user', () => {
    authService.getCurrentUser.mockReturnValue(of(mockUser));

    let result: CurrentUserResponse | null = null;
    service.checkSession().subscribe(u => result = u);

    expect(result).toEqual(mockUser);
    expect(service.currentUser).toEqual(mockUser);
  });

  it('should return null and clear user on session check failure', () => {
    authService.getCurrentUser.mockReturnValue(throwError(() => new Error('401')));

    let result: CurrentUserResponse | null = mockUser;
    service.checkSession().subscribe(u => result = u);

    expect(result).toBeNull();
    expect(service.currentUser).toBeNull();
  });

  it('should set user via setUser', () => {
    service.setUser(mockUser);
    expect(service.currentUser).toEqual(mockUser);
  });

  it('should check setup needed and return true', () => {
    setupService.getSetupStatus.mockReturnValue(of({ needsSetup: true }));

    let result = false;
    service.checkSetupNeeded().subscribe(v => result = v);

    expect(result).toBe(true);
  });

  it('should check setup needed and return false', () => {
    setupService.getSetupStatus.mockReturnValue(of({ needsSetup: false }));

    let result = true;
    service.checkSetupNeeded().subscribe(v => result = v);

    expect(result).toBe(false);
  });

  it('should return false on setup check error', () => {
    setupService.getSetupStatus.mockReturnValue(throwError(() => new Error('fail')));

    let result = true;
    service.checkSetupNeeded().subscribe(v => result = v);

    expect(result).toBe(false);
  });

  it('refreshUser should delegate to checkSession', () => {
    authService.getCurrentUser.mockReturnValue(of(mockUser));

    let result: CurrentUserResponse | null = null;
    service.refreshUser().subscribe(u => result = u);

    expect(authService.getCurrentUser).toHaveBeenCalled();
    expect(result).toEqual(mockUser);
  });
});
