import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CategoriesService } from '../../api/generated';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { ConfigureCategoriesSectionComponent } from './configure-categories-section.component';

const mockCategories: CategoryDto[] = [
  { id: 'cat-1', name: 'Streaming', color: '#FF0000' },
  { id: 'cat-2', name: 'Insurance', color: '#00FF00' },
];

describe('ConfigureCategoriesSectionComponent', () => {
  let component: ConfigureCategoriesSectionComponent;
  let fixture: ComponentFixture<ConfigureCategoriesSectionComponent>;
  let categoriesService: jest.Mocked<CategoriesService>;

  beforeEach(async () => {
    const categoriesServiceMock = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConfigureCategoriesSectionComponent],
      providers: [
        provideRouter([]),
        { provide: CategoriesService, useValue: categoriesServiceMock },
      ],
    })
      .overrideComponent(ConfigureCategoriesSectionComponent, {
        set: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    categoriesService = TestBed.inject(CategoriesService) as jest.Mocked<CategoriesService>;
    fixture = TestBed.createComponent(ConfigureCategoriesSectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load categories on init', () => {
    fixture.detectChanges();

    expect(categoriesService.getCategories).toHaveBeenCalled();
    expect(component.categories).toEqual(mockCategories);
    expect(component.categoriesLoading).toBe(false);
  });

  it('should render the section header and category names', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Categories');
    expect(el.textContent).toContain('Streaming');
    expect(el.textContent).toContain('Insurance');
  });

  it('should render category count', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('2');
  });

  it('should show error on categories load failure', () => {
    categoriesService.getCategories.mockReturnValue(
      throwError(() => ({ error: { message: 'Server error' } }))
    );

    fixture.detectChanges();

    expect(component.categoriesError).toBe('Server error');
    expect(component.categoriesLoading).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Server error');
  });

  it('should show generic error when categories load fails without message', () => {
    categoriesService.getCategories.mockReturnValue(throwError(() => ({ error: {} })));

    fixture.detectChanges();

    expect(component.categoriesError).toBe('Failed to load categories.');
  });

  it('should show empty state when no categories', () => {
    categoriesService.getCategories.mockReturnValue(of([]));

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No categories yet');
  });

  it('should add category to list when onCategoryCreated is called', () => {
    fixture.detectChanges();
    const newCategory: CategoryDto = { id: 'cat-3', name: 'Food', color: '#a78bfa' };

    component.onCategoryCreated(newCategory);

    expect(component.categories).toEqual([...mockCategories, newCategory]);
  });

  it('should start editing a category', () => {
    fixture.detectChanges();

    component.startEdit(component.categories[0]);

    expect(component.editingId).toBe('cat-1');
    expect(component.editName).toBe('Streaming');
    expect(component.editColor).toBe('#FF0000');
  });

  it('should use default color when category has no color', () => {
    fixture.detectChanges();

    component.startEdit({ id: 'cat-x', name: 'NoColor' });

    expect(component.editColor).toBe('#6b7194');
  });

  it('should cancel editing', () => {
    fixture.detectChanges();
    component.startEdit(component.categories[0]);

    component.cancelEdit();

    expect(component.editingId).toBeNull();
    expect(component.editName).toBe('');
    expect(component.editColor).toBe('');
  });

  it('should save edited category', () => {
    const updated: CategoryDto = { id: 'cat-1', name: 'Movies', color: '#0000FF' };
    categoriesService.updateCategory.mockReturnValue(of(updated));
    fixture.detectChanges();

    component.startEdit(component.categories[0]);
    component.editName = 'Movies';
    component.editColor = '#0000FF';
    component.saveEdit(component.categories[0]);

    expect(categoriesService.updateCategory).toHaveBeenCalledWith('cat-1', { name: 'Movies', color: '#0000FF' });
    expect(component.categories[0].name).toBe('Movies');
    expect(component.editingId).toBeNull();
    expect(component.savingEdit).toBe(false);
  });

  it('should not save with empty name', () => {
    fixture.detectChanges();
    component.startEdit(component.categories[0]);
    component.editName = '   ';

    component.saveEdit(component.categories[0]);

    expect(categoriesService.updateCategory).not.toHaveBeenCalled();
  });

  it('should show error on save edit failure', () => {
    categoriesService.updateCategory.mockReturnValue(
      throwError(() => ({ error: { message: 'Update failed' } }))
    );
    fixture.detectChanges();

    component.startEdit(component.categories[0]);
    component.editName = 'New Name';
    component.saveEdit(component.categories[0]);

    expect(component.editError).toBe('Update failed');
    expect(component.savingEdit).toBe(false);
  });

  it('should delete a category', () => {
    categoriesService.deleteCategory.mockReturnValue(of(undefined));
    fixture.detectChanges();

    component.deleteCategory(component.categories[0]);

    expect(categoriesService.deleteCategory).toHaveBeenCalledWith('cat-1');
    expect(component.categories).toEqual([mockCategories[1]]);
    expect(component.deletingId).toBeNull();
  });

  it('should show error on delete failure', () => {
    categoriesService.deleteCategory.mockReturnValue(
      throwError(() => ({ error: { message: 'Cannot delete' } }))
    );
    fixture.detectChanges();

    component.deleteCategory(component.categories[0]);

    expect(component.deleteError).toBe('Cannot delete');
    expect(component.deletingId).toBeNull();
    expect(component.categories).toEqual(mockCategories);
  });

  it('should show generic error on delete failure without message', () => {
    categoriesService.deleteCategory.mockReturnValue(throwError(() => ({ error: {} })));
    fixture.detectChanges();

    component.deleteCategory(component.categories[0]);

    expect(component.deleteError).toBe('Failed to delete category.');
  });

  it('should retry loading categories on error', () => {
    categoriesService.getCategories.mockReturnValue(
      throwError(() => ({ error: { message: 'fail' } }))
    );
    fixture.detectChanges();
    expect(component.categoriesError).toBe('fail');

    categoriesService.getCategories.mockReturnValue(of(mockCategories));
    component.loadCategories();

    expect(component.categories).toEqual(mockCategories);
    expect(component.categoriesError).toBeNull();
  });
});
