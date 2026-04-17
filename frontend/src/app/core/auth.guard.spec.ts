import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthStateService } from './auth-state.service';
import { AuthNavigationService } from './auth-navigation.service';
import { CurrentUserResponse, UserRole } from '../api/generated';

const mockUser: CurrentUserResponse = { id: 'u1', username: 'admin', role: UserRole.Admin };
const mockRoute = {} as ActivatedRouteSnapshot;
const mockState = { url: '/transactions?search=netflix&page=1' } as RouterStateSnapshot;

describe('authGuard', () => {
  let authState: { currentUser: CurrentUserResponse | null; checkSession: jest.Mock };
  let authNavigation: { createLoginRedirectTree: jest.Mock };

  beforeEach(() => {
    authState = {
      currentUser: null,
      checkSession: jest.fn(),
    };
    authNavigation = {
      createLoginRedirectTree: jest.fn().mockReturnValue('login-tree'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: AuthNavigationService, useValue: authNavigation },
      ],
    });
  });

  function runGuard(): boolean | Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState)) as boolean | Observable<boolean | UrlTree>;
  }

  it('should return true if user is already logged in', () => {
    authState.currentUser = mockUser;

    expect(runGuard()).toBe(true);
  });

  it('should check session and return true if user exists', (done) => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(mockUser));

    const result = runGuard();
    (result as Observable<boolean | UrlTree>).subscribe((val) => {
      expect(val).toBe(true);
      done();
    });
  });

  it('should redirect to /login if no session', (done) => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(null));

    const result = runGuard();
    (result as Observable<boolean | UrlTree>).subscribe((val) => {
      expect(val).toBe('login-tree');
      expect(authNavigation.createLoginRedirectTree).toHaveBeenCalledWith('/transactions?search=netflix&page=1');
      done();
    });
  });

  it('should propagate error when checkSession observable fails', (done) => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(throwError(() => new Error('Network error')));

    const result = runGuard();
    (result as Observable<boolean | UrlTree>).subscribe({
      next: () => done.fail('expected error'),
      error: (err: Error) => {
        expect(err.message).toBe('Network error');
        done();
      },
    });
  });
});
