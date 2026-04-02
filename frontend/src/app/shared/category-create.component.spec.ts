import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CategoryCreateComponent } from './category-create.component';
import { CategoriesService } from '../api/generated';
import { CategoryDto } from '../api/generated/model/categoryDto';

describe('CategoryCreateComponent', () => {
  let component: CategoryCreateComponent;
  let fixture: ComponentFixture<CategoryCreateComponent>;
  let categoriesService: jest.Mocked<CategoriesService>;

  beforeEach(async () => {
    const categoriesServiceMock = {
      createCategory: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CategoryCreateComponent],
      providers: [
        { provide: CategoriesService, useValue: categoriesServiceMock },
      ],
    })
    .overrideComponent(CategoryCreateComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    categoriesService = TestBed.inject(CategoriesService) as jest.Mocked<CategoriesService>;
    fixture = TestBed.createComponent(CategoryCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render input and button', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('input[type="text"], input[placeholder]')).toBeTruthy();
    expect(el.querySelector('input[type="color"]')).toBeTruthy();
    expect(el.textContent).toContain('Add');
  });

  it('should create a category and emit created event', () => {
    const newCat: CategoryDto = { id: 'cat-1', name: 'Food', color: '#a78bfa' };
    categoriesService.createCategory.mockReturnValue(of(newCat));
    const emitSpy = jest.spyOn(component.created, 'emit');

    component.name = 'Food';
    component.color = '#a78bfa';
    component.create();

    expect(categoriesService.createCategory).toHaveBeenCalledWith({ name: 'Food', color: '#a78bfa' });
    expect(emitSpy).toHaveBeenCalledWith(newCat);
    expect(component.name).toBe('');
    expect(component.color).toBe('#a78bfa');
    expect(component.creating).toBe(false);
  });

  it('should not create with empty name', () => {
    component.name = '   ';
    component.create();

    expect(categoriesService.createCategory).not.toHaveBeenCalled();
  });

  it('should show error on failure', () => {
    categoriesService.createCategory.mockReturnValue(
      throwError(() => ({ error: { message: 'Category already exists' } }))
    );

    component.name = 'Streaming';
    component.create();

    expect(component.error).toBe('Category already exists');
    expect(component.creating).toBe(false);
  });

  it('should show generic error when no message', () => {
    categoriesService.createCategory.mockReturnValue(
      throwError(() => ({ error: {} }))
    );

    component.name = 'Test';
    component.create();

    expect(component.error).toBe('Failed to create category.');
  });

  it('should reset error before new create attempt', () => {
    categoriesService.createCategory.mockReturnValue(
      throwError(() => ({ error: { message: 'fail' } }))
    );
    component.name = 'A';
    component.create();
    expect(component.error).toBe('fail');

    const newCat: CategoryDto = { id: 'cat-1', name: 'A', color: '#a78bfa' };
    categoriesService.createCategory.mockReturnValue(of(newCat));
    component.name = 'A';
    component.create();

    expect(component.error).toBeNull();
  });
});
