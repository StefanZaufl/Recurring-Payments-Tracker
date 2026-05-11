import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { setupGuard } from './setup.guard';
import { AuthStateService } from './auth-state.service';

const mockRoute = {} as ActivatedRouteSnapshot;
const mockState = {} as RouterStateSnapshot;

describe('setupGuard', () => {
  let authState: { checkSetupNeeded: jest.Mock };
  let router: Router;

  beforeEach(() => {
    authState = {
      checkSetupNeeded: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: { createUrlTree: jest.fn().mockReturnValue('login-tree') } },
      ],
    });

    router = TestBed.inject(Router);
  });

  function runGuard(): Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() => setupGuard(mockRoute, mockState)) as Observable<boolean | UrlTree>;
  }

  it('should return true if setup is needed', (done) => {
    authState.checkSetupNeeded.mockReturnValue(of(true));

    runGuard().subscribe((val) => {
      expect(val).toBe(true);
      done();
    });
  });

  it('should redirect to /login if setup is not needed', (done) => {
    authState.checkSetupNeeded.mockReturnValue(of(false));

    runGuard().subscribe((val) => {
      expect(val).toBe('login-tree');
      expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
      done();
    });
  });

  it('should propagate error when checkSetupNeeded observable fails', (done) => {
    authState.checkSetupNeeded.mockReturnValue(throwError(() => new Error('Network error')));

    runGuard().subscribe({
      next: () => done.fail('expected error'),
      error: (err: Error) => {
        expect(err.message).toBe('Network error');
        done();
      },
    });
  });
});
