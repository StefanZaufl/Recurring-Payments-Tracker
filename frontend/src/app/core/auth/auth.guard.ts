import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { map } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { AuthNavigationService } from './auth-navigation.service';

export const authGuard: CanActivateFn = (_, state) => {
  const authState = inject(AuthStateService);
  const authNavigation = inject(AuthNavigationService);

  if (authState.currentUser) {
    return true;
  }

  return authState.checkSession().pipe(
    map(user => {
      if (user) {
        return true;
      }
      return authNavigation.createLoginRedirectTree(state.url);
    })
  );
};
