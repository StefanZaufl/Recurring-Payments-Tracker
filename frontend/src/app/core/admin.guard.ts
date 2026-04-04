import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { UserRole } from '../api/generated';

export const adminGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  if (authState.currentUser) {
    return authState.currentUser.role === UserRole.Admin
      ? true
      : router.createUrlTree(['/dashboard']);
  }

  return authState.checkSession().pipe(
    map(user => {
      if (user?.role === UserRole.Admin) {
        return true;
      }
      return router.createUrlTree(['/dashboard']);
    })
  );
};
