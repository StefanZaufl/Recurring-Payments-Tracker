import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { AuthService, SetupService, CurrentUserResponse, UserRole } from '../api/generated';

@Injectable({ providedIn: 'root' })
export class AuthStateService {

  private currentUserSubject = new BehaviorSubject<CurrentUserResponse | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();
  isLoggedIn$ = this.currentUser$.pipe(map(u => u !== null));
  isAdmin$ = this.currentUser$.pipe(map(u => u?.role === UserRole.Admin));

  constructor(
    private authService: AuthService,
    private setupService: SetupService,
    private router: Router
  ) {}

  get currentUser(): CurrentUserResponse | null {
    return this.currentUserSubject.value;
  }

  login(username: string, password: string): Observable<CurrentUserResponse> {
    return this.authService.login({ username, password }).pipe(
      tap(user => this.currentUserSubject.next(user))
    );
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
      },
      error: () => {
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
      }
    });
  }

  checkSession(): Observable<CurrentUserResponse | null> {
    return this.authService.getCurrentUser().pipe(
      tap(user => this.currentUserSubject.next(user)),
      catchError(() => {
        this.currentUserSubject.next(null);
        return of(null);
      })
    );
  }

  refreshUser(): Observable<CurrentUserResponse | null> {
    return this.checkSession();
  }

  setUser(user: CurrentUserResponse): void {
    this.currentUserSubject.next(user);
  }

  checkSetupNeeded(): Observable<boolean> {
    return this.setupService.getSetupStatus().pipe(
      map(status => status.needsSetup),
      catchError(() => of(false))
    );
  }
}
