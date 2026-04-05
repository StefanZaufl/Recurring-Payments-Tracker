import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError(error => {
      const pathname = new URL(req.url, window.location.origin).pathname;
      if (error.status === 401 && !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/setup/')) {
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
