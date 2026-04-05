import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { of } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthStateService } from './auth-state.service';
import { CurrentUserResponse, UserRole } from '../api/generated';

const mockUser: CurrentUserResponse = { id: 'u1', username: 'admin', role: UserRole.Admin };

describe('authGuard', () => {
  let authState: { currentUser: CurrentUserResponse | null; checkSession: jest.Mock };
  let router: Router;

  beforeEach(() => {
    authState = {
      currentUser: null,
      checkSession: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: { createUrlTree: jest.fn().mockReturnValue('login-tree') } },
      ],
    });

    router = TestBed.inject(Router);
  });

  function runGuard(): any {
    return TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
  }

  it('should return true if user is already logged in', () => {
    authState.currentUser = mockUser;

    expect(runGuard()).toBe(true);
  });

  it('should check session and return true if user exists', (done) => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(mockUser));

    const result = runGuard();
    result.subscribe((val: any) => {
      expect(val).toBe(true);
      done();
    });
  });

  it('should redirect to /login if no session', (done) => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(null));

    const result = runGuard();
    result.subscribe((val: any) => {
      expect(val).toBe('login-tree');
      expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
      done();
    });
  });
});
