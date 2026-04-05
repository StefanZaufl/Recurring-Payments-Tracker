import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { adminGuard } from './admin.guard';
import { AuthStateService } from './auth-state.service';
import { CurrentUserResponse, UserRole } from '../api/generated';

const adminUser: CurrentUserResponse = { id: 'u1', username: 'admin', role: UserRole.Admin };
const regularUser: CurrentUserResponse = { id: 'u2', username: 'user', role: UserRole.User };
const mockRoute = {} as ActivatedRouteSnapshot;
const mockState = {} as RouterStateSnapshot;

describe('adminGuard', () => {
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
        { provide: Router, useValue: { createUrlTree: jest.fn().mockReturnValue('dashboard-tree') } },
      ],
    });

    router = TestBed.inject(Router);
  });

  function runGuard(): boolean | Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState)) as boolean | Observable<boolean | UrlTree>;
  }

  it('should return true if current user is admin', () => {
    authState.currentUser = adminUser;
    expect(runGuard()).toBe(true);
  });

  it('should redirect to /dashboard if current user is not admin', () => {
    authState.currentUser = regularUser;
    expect(runGuard()).toBe('dashboard-tree');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should check session and return true if user is admin', (done) => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(adminUser));

    const result = runGuard();
    (result as Observable<boolean | UrlTree>).subscribe((val) => {
      expect(val).toBe(true);
      done();
    });
  });

  it('should check session and redirect if user is not admin', (done) => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(regularUser));

    const result = runGuard();
    (result as Observable<boolean | UrlTree>).subscribe((val) => {
      expect(val).toBe('dashboard-tree');
      done();
    });
  });

  it('should redirect if no session exists', (done) => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(null));

    const result = runGuard();
    (result as Observable<boolean | UrlTree>).subscribe((val) => {
      expect(val).toBe('dashboard-tree');
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
