import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthNavigationService } from './auth-navigation.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authNavigation = inject(AuthNavigationService);

  return next(req).pipe(
    catchError(error => {
      const pathname = new URL(req.url, window.location.origin).pathname;
      if (error.status === 401 && !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/setup/')) {
        authNavigation.redirectToLogin(authNavigation.currentAppUrl());
      }
      return throwError(() => error);
    })
  );
};
