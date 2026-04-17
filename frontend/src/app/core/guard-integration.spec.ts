import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { AuthStateService } from './auth-state.service';
import { CurrentUserResponse, UserRole } from '../api/generated';

@Component({ template: '', standalone: true })
class DummyComponent {}

const adminUser: CurrentUserResponse = { id: 'u1', username: 'admin', role: UserRole.Admin };
const regularUser: CurrentUserResponse = { id: 'u2', username: 'user', role: UserRole.User };

describe('Guard chaining (authGuard + adminGuard)', () => {
  let authState: { currentUser: CurrentUserResponse | null; checkSession: jest.Mock };
  let router: Router;

  beforeEach(() => {
    authState = {
      currentUser: null,
      checkSession: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin/users', canActivate: [authGuard, adminGuard], component: DummyComponent },
          { path: 'login', component: DummyComponent },
          { path: 'dashboard', component: DummyComponent },
        ]),
        { provide: AuthStateService, useValue: authState },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('should allow admin users to access admin routes', async () => {
    authState.currentUser = adminUser;

    const success = await router.navigateByUrl('/admin/users');

    expect(success).toBe(true);
    expect(router.url).toBe('/admin/users');
  });

  it('should redirect non-admin users to /dashboard', async () => {
    authState.currentUser = regularUser;

    await router.navigateByUrl('/admin/users');

    expect(router.url).toBe('/dashboard');
  });

  it('should redirect unauthenticated users to /login', async () => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(null));

    await router.navigateByUrl('/admin/users?tab=RECURRING');

    expect(router.url).toBe('/login?returnUrl=%2Fadmin%2Fusers%3Ftab%3DRECURRING');
  });

  it('should allow admin user after session check', async () => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(adminUser));

    const success = await router.navigateByUrl('/admin/users');

    expect(success).toBe(true);
    expect(router.url).toBe('/admin/users');
  });

  it('should redirect regular user to /dashboard after session check', async () => {
    authState.currentUser = null;
    authState.checkSession.mockReturnValue(of(regularUser));

    await router.navigateByUrl('/admin/users');

    expect(router.url).toBe('/dashboard');
  });
});
