import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { setupGuard } from './setup.guard';
import { AuthStateService } from './auth-state.service';

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

  function runGuard(): any {
    return TestBed.runInInjectionContext(() => setupGuard({} as any, {} as any));
  }

  it('should return true if setup is needed', (done) => {
    authState.checkSetupNeeded.mockReturnValue(of(true));

    runGuard().subscribe((val: any) => {
      expect(val).toBe(true);
      done();
    });
  });

  it('should redirect to /login if setup is not needed', (done) => {
    authState.checkSetupNeeded.mockReturnValue(of(false));

    runGuard().subscribe((val: any) => {
      expect(val).toBe('login-tree');
      expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
      done();
    });
  });
});
