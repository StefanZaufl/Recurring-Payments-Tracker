import { Injectable, inject } from '@angular/core';
import { NavigationExtras, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthNavigationService {
  private router = inject(Router);

  createLoginRedirectTree(returnUrl?: string | null): UrlTree {
    return this.router.createUrlTree(['/login'], this.buildLoginExtras(returnUrl));
  }

  redirectToLogin(returnUrl?: string | null): Promise<boolean> {
    return this.router.navigate(['/login'], this.buildLoginExtras(returnUrl));
  }

  resolvePostLoginUrl(returnUrl?: string | null): string {
    return this.sanitizeReturnUrl(returnUrl) ?? '/dashboard';
  }

  currentAppUrl(): string {
    return this.router.url || '/';
  }

  private buildLoginExtras(returnUrl?: string | null): NavigationExtras {
    const sanitizedReturnUrl = this.sanitizeReturnUrl(returnUrl);
    return sanitizedReturnUrl
      ? { queryParams: { returnUrl: sanitizedReturnUrl } }
      : {};
  }

  private sanitizeReturnUrl(returnUrl?: string | null): string | null {
    if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
      return null;
    }

    return returnUrl;
  }
}
