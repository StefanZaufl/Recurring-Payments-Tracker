import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { SetupComponent } from './setup.component';
import { SetupService, CurrentUserResponse, UserRole } from '../../api/generated';
import { AuthStateService } from '../../core/auth-state.service';

const mockUser: CurrentUserResponse = { id: 'u1', username: 'admin', role: UserRole.Admin };

describe('SetupComponent', () => {
  let component: SetupComponent;
  let fixture: ComponentFixture<SetupComponent>;
  let setupService: jest.Mocked<SetupService>;
  let authState: jest.Mocked<AuthStateService>;
  let router: jest.Mocked<Router>;

  beforeEach(async () => {
    const setupServiceMock = {
      initializeSetup: jest.fn(),
    };
    const authStateMock = {
      setUser: jest.fn(),
    };
    const routerMock = {
      navigate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SetupComponent],
      providers: [
        { provide: SetupService, useValue: setupServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: Router, useValue: routerMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    setupService = TestBed.inject(SetupService) as jest.Mocked<SetupService>;
    authState = TestBed.inject(AuthStateService) as jest.Mocked<AuthStateService>;
    router = TestBed.inject(Router) as jest.Mocked<Router>;
    fixture = TestBed.createComponent(SetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render setup form', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Welcome');
    expect(el.textContent).toContain('Create admin account');
  });

  it('should show error when fields are empty', () => {
    component.onSubmit();
    expect(component.error).toBe('Please fill in all fields.');
    expect(setupService.initializeSetup).not.toHaveBeenCalled();
  });

  it('should show error when passwords do not match', () => {
    component.username = 'admin';
    component.password = 'password1';
    component.confirmPassword = 'password2';
    component.onSubmit();

    expect(component.error).toBe('Passwords do not match.');
  });

  it('should show error when password is too short', () => {
    component.username = 'admin';
    component.password = 'short';
    component.confirmPassword = 'short';
    component.onSubmit();

    expect(component.error).toBe('Password must be at least 8 characters.');
  });

  it('should call setup API and navigate on success', () => {
    setupService.initializeSetup.mockReturnValue(of(mockUser));

    component.username = 'admin';
    component.password = 'securepass';
    component.confirmPassword = 'securepass';
    component.onSubmit();

    expect(setupService.initializeSetup).toHaveBeenCalledWith({ username: 'admin', password: 'securepass' });
    expect(authState.setUser).toHaveBeenCalledWith(mockUser);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should show error on 409 (setup already complete)', () => {
    setupService.initializeSetup.mockReturnValue(throwError(() => ({ status: 409 })));

    component.username = 'admin';
    component.password = 'securepass';
    component.confirmPassword = 'securepass';
    component.onSubmit();

    expect(component.error).toBe('Setup has already been completed.');
    expect(component.loading).toBe(false);
  });

  it('should show generic error on other failures', () => {
    setupService.initializeSetup.mockReturnValue(throwError(() => ({ status: 500 })));

    component.username = 'admin';
    component.password = 'securepass';
    component.confirmPassword = 'securepass';
    component.onSubmit();

    expect(component.error).toBe('An error occurred. Please try again.');
    expect(component.loading).toBe(false);
  });

  it('should display error in template', () => {
    component.username = 'admin';
    component.password = 'short';
    component.confirmPassword = 'short';
    component.onSubmit();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Password must be at least 8 characters.');
  });
});
