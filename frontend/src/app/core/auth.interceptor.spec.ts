import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthNavigationService } from './auth-navigation.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authNavigation: jest.Mocked<AuthNavigationService>;

  beforeEach(() => {
    const authNavigationMock = {
      redirectToLogin: jest.fn(),
      currentAppUrl: jest.fn().mockReturnValue('/transactions?search=netflix&page=1'),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthNavigationService, useValue: authNavigationMock },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    authNavigation = TestBed.inject(AuthNavigationService) as jest.Mocked<AuthNavigationService>;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should pass through successful requests', () => {
    http.get('/api/data').subscribe();
    const req = httpTesting.expectOne('/api/data');
    req.flush({ ok: true });

    expect(authNavigation.redirectToLogin).not.toHaveBeenCalled();
  });

  it('should redirect to /login on 401 for non-auth URLs', () => {
    http.get('/api/data').subscribe({ error: () => { /* expected error */ } });
    const req = httpTesting.expectOne('/api/data');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authNavigation.currentAppUrl).toHaveBeenCalled();
    expect(authNavigation.redirectToLogin).toHaveBeenCalledWith('/transactions?search=netflix&page=1');
  });

  it('should not redirect on 401 for /api/auth/ URLs', () => {
    http.get('/api/auth/me').subscribe({ error: () => { /* expected error */ } });
    const req = httpTesting.expectOne('/api/auth/me');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authNavigation.redirectToLogin).not.toHaveBeenCalled();
  });

  it('should not redirect on 401 for /api/setup/ URLs', () => {
    http.get('/api/setup/status').subscribe({ error: () => { /* expected error */ } });
    const req = httpTesting.expectOne('/api/setup/status');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authNavigation.redirectToLogin).not.toHaveBeenCalled();
  });

  it('should not redirect on non-401 errors', () => {
    http.get('/api/data').subscribe({ error: () => { /* expected error */ } });
    const req = httpTesting.expectOne('/api/data');
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    expect(authNavigation.redirectToLogin).not.toHaveBeenCalled();
  });
});
