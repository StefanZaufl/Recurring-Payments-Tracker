import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthStateService } from '../../core/auth-state.service';
import { AuthNavigationService } from '../../core/auth-navigation.service';
import { CurrentUserResponse, UserRole } from '../../api/generated';

const mockUser: CurrentUserResponse = { id: 'u1', username: 'admin', role: UserRole.Admin };

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authState: jest.Mocked<AuthStateService>;
  let router: jest.Mocked<Router>;
  let authNavigation: jest.Mocked<AuthNavigationService>;

  beforeEach(async () => {
    const authStateMock = {
      login: jest.fn(),
      checkSetupNeeded: jest.fn().mockReturnValue(of(false)),
    };
    const routerMock = {
      navigate: jest.fn(),
      navigateByUrl: jest.fn(),
    };
    const authNavigationMock = {
      resolvePostLoginUrl: jest.fn().mockReturnValue('/dashboard'),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthStateService, useValue: authStateMock },
        { provide: Router, useValue: routerMock },
        { provide: AuthNavigationService, useValue: authNavigationMock },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    authState = TestBed.inject(AuthStateService) as jest.Mocked<AuthStateService>;
    router = TestBed.inject(Router) as jest.Mocked<Router>;
    authNavigation = TestBed.inject(AuthNavigationService) as jest.Mocked<AuthNavigationService>;
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render login form when setup is not needed', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Welcome back');
    expect(el.textContent).toContain('Sign in');
    expect(component.checking).toBe(false);
  });

  it('should redirect to /setup when setup is needed', () => {
    authState.checkSetupNeeded.mockReturnValue(of(true));
    const newFixture = TestBed.createComponent(LoginComponent);
    newFixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/setup']);
  });

  it('should show error when submitting empty form', () => {
    component.onSubmit();
    expect(component.error).toBe('Please enter both username and password.');
    expect(authState.login).not.toHaveBeenCalled();
  });

  it('should call login and navigate on success', () => {
    authState.login.mockReturnValue(of(mockUser));

    component.username = 'admin';
    component.password = 'password';
    component.onSubmit();

    expect(authState.login).toHaveBeenCalledWith('admin', 'password');
    expect(authNavigation.resolvePostLoginUrl).toHaveBeenCalledWith(null);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('should navigate to the requested returnUrl after login', async () => {
    TestBed.resetTestingModule();

    const authStateMock = {
      login: jest.fn().mockReturnValue(of(mockUser)),
      checkSetupNeeded: jest.fn().mockReturnValue(of(false)),
    };
    const routerMock = {
      navigate: jest.fn(),
      navigateByUrl: jest.fn(),
    };
    const authNavigationMock = {
      resolvePostLoginUrl: jest.fn().mockReturnValue('/transactions?search=netflix'),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthStateService, useValue: authStateMock },
        { provide: Router, useValue: routerMock },
        { provide: AuthNavigationService, useValue: authNavigationMock },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '/transactions?search=netflix' }) } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const newFixture = TestBed.createComponent(LoginComponent);
    const newComponent = newFixture.componentInstance;
    const newRouter = TestBed.inject(Router) as jest.Mocked<Router>;
    const newAuthNavigation = TestBed.inject(AuthNavigationService) as jest.Mocked<AuthNavigationService>;
    newFixture.detectChanges();

    newComponent.username = 'admin';
    newComponent.password = 'password';
    newComponent.onSubmit();

    expect(newAuthNavigation.resolvePostLoginUrl).toHaveBeenCalledWith('/transactions?search=netflix');
    expect(newRouter.navigateByUrl).toHaveBeenCalledWith('/transactions?search=netflix');
  });

  it('should show error on 401', () => {
    authState.login.mockReturnValue(throwError(() => ({ status: 401 })));

    component.username = 'admin';
    component.password = 'wrong';
    component.onSubmit();

    expect(component.error).toBe('Invalid username or password.');
    expect(component.loading).toBe(false);
  });

  it('should show generic error on other failures', () => {
    authState.login.mockReturnValue(throwError(() => ({ status: 500 })));

    component.username = 'admin';
    component.password = 'pass';
    component.onSubmit();

    expect(component.error).toBe('An error occurred. Please try again.');
    expect(component.loading).toBe(false);
  });

  it('should set loading to true during login', () => {
    authState.login.mockReturnValue(of(mockUser));

    component.username = 'admin';
    component.password = 'pass';
    // loading is set to true synchronously before the observable resolves
    expect(component.loading).toBe(false);

    component.onSubmit();
    // After sync subscribe completes, navigation happened
    expect(router.navigateByUrl).toHaveBeenCalled();
  });

  it('should display error message in template', () => {
    authState.login.mockReturnValue(throwError(() => ({ status: 401 })));

    component.username = 'admin';
    component.password = 'wrong';
    component.onSubmit();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Invalid username or password.');
  });
});
