import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let router: jest.Mocked<Router>;

  beforeEach(() => {
    const routerMock = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerMock },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router) as jest.Mocked<Router>;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should pass through successful requests', () => {
    http.get('/api/data').subscribe();
    const req = httpTesting.expectOne('/api/data');
    req.flush({ ok: true });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should redirect to /login on 401 for non-auth URLs', () => {
    http.get('/api/data').subscribe({ error: () => { /* expected error */ } });
    const req = httpTesting.expectOne('/api/data');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should not redirect on 401 for /api/auth/ URLs', () => {
    http.get('/api/auth/me').subscribe({ error: () => { /* expected error */ } });
    const req = httpTesting.expectOne('/api/auth/me');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should not redirect on 401 for /api/setup/ URLs', () => {
    http.get('/api/setup/status').subscribe({ error: () => { /* expected error */ } });
    const req = httpTesting.expectOne('/api/setup/status');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should not redirect on non-401 errors', () => {
    http.get('/api/data').subscribe({ error: () => { /* expected error */ } });
    const req = httpTesting.expectOne('/api/data');
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
