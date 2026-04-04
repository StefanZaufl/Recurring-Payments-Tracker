import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthStateService } from './auth-state.service';

export const setupGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  return authState.checkSetupNeeded().pipe(
    map(needsSetup => {
      if (needsSetup) {
        return true;
      }
      return router.createUrlTree(['/login']);
    })
  );
};
