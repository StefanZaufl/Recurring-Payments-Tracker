import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ConfigureComponent } from './configure.component';
import { TransactionsService, CategoriesService } from '../../api/generated';
import { UploadResponse } from '../../api/generated/model/uploadResponse';
import { CategoryDto } from '../../api/generated/model/categoryDto';

const mockUploadResponse: UploadResponse = {
  uploadId: 'abc-123',
  transactionCount: 42,
  recurringPaymentsDetected: 5,
};

const mockCategories: CategoryDto[] = [
  { id: 'cat-1', name: 'Streaming', color: '#FF0000' },
  { id: 'cat-2', name: 'Insurance', color: '#00FF00' },
];

describe('ConfigureComponent', () => {
  let component: ConfigureComponent;
  let fixture: ComponentFixture<ConfigureComponent>;
  let transactionsService: jest.Mocked<TransactionsService>;
  let categoriesService: jest.Mocked<CategoriesService>;

  beforeEach(async () => {
    const transactionsServiceMock = {
      uploadCsv: jest.fn().mockReturnValue(of(mockUploadResponse)),
    };
    const categoriesServiceMock = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConfigureComponent],
      providers: [
        provideRouter([]),
        { provide: TransactionsService, useValue: transactionsServiceMock },
        { provide: CategoriesService, useValue: categoriesServiceMock },
      ],
    })
    .overrideComponent(ConfigureComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    transactionsService = TestBed.inject(TransactionsService) as jest.Mocked<TransactionsService>;
    categoriesService = TestBed.inject(CategoriesService) as jest.Mocked<CategoriesService>;
    fixture = TestBed.createComponent(ConfigureComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render page header', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Configure');
    expect(el.textContent).toContain('Import data and manage categories');
  });

  // ─── Upload Section ───

  it('should render upload area', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Drag & drop your CSV file');
    expect(el.textContent).toContain('click to browse');
  });

  it('should not show upload result or error initially', () => {
    fixture.detectChanges();
    expect(component.uploadResult).toBeNull();
    expect(component.uploadError).toBeNull();
    expect(component.uploading).toBe(false);
  });

  it('should upload file on file selection', () => {
    fixture.detectChanges();
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const event = { target: { files: [file] } } as unknown as Event;

    component.onFileSelected(event);

    expect(transactionsService.uploadCsv).toHaveBeenCalledWith(file);
    expect(component.uploadResult).toEqual(mockUploadResponse);
    expect(component.uploading).toBe(false);
  });

  it('should show success message after upload', () => {
    fixture.detectChanges();
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Upload successful');
    expect(el.textContent).toContain('42');
    expect(el.textContent).toContain('transactions imported');
    expect(el.textContent).toContain('5');
    expect(el.textContent).toContain('recurring payments detected');
  });

  it('should show error message on upload failure', () => {
    fixture.detectChanges();
    transactionsService.uploadCsv.mockReturnValue(
      throwError(() => ({ error: { message: 'Invalid CSV format' } }))
    );

    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(component.uploadError).toBe('Invalid CSV format');
    expect(el.textContent).toContain('Invalid CSV format');
    expect(component.uploadResult).toBeNull();
  });

  it('should show generic error when no message in upload response', () => {
    fixture.detectChanges();
    transactionsService.uploadCsv.mockReturnValue(
      throwError(() => ({ error: {} }))
    );

    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    expect(component.uploadError).toBe('Upload failed. Please try again.');
  });

  it('should handle drag over', () => {
    fixture.detectChanges();
    const event = { preventDefault: jest.fn() } as unknown as DragEvent;
    component.onDragOver(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragging).toBe(true);
  });

  it('should handle drop with file', () => {
    fixture.detectChanges();
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const event = {
      preventDefault: jest.fn(),
      dataTransfer: { files: [file] },
    } as unknown as DragEvent;

    component.onDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragging).toBe(false);
    expect(transactionsService.uploadCsv).toHaveBeenCalledWith(file);
  });

  it('should handle drop without file', () => {
    fixture.detectChanges();
    const event = {
      preventDefault: jest.fn(),
      dataTransfer: { files: [] },
    } as unknown as DragEvent;

    component.onDrop(event);

    expect(component.isDragging).toBe(false);
    expect(transactionsService.uploadCsv).not.toHaveBeenCalled();
  });

  it('should reset upload result and error before new upload', () => {
    fixture.detectChanges();
    component.uploadResult = mockUploadResponse;
    component.uploadError = 'old error';

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    expect(component.uploadError).toBeNull();
    expect(component.uploadResult).toEqual(mockUploadResponse);
  });

  it('should ignore file selection when no file chosen', () => {
    fixture.detectChanges();
    const event = { target: { files: [] } } as unknown as Event;
    component.onFileSelected(event);

    expect(transactionsService.uploadCsv).not.toHaveBeenCalled();
  });

  // ─── Categories Section ───

  it('should load categories on init', () => {
    fixture.detectChanges();

    expect(categoriesService.getCategories).toHaveBeenCalled();
    expect(component.categories).toEqual(mockCategories);
    expect(component.categoriesLoading).toBe(false);
  });

  it('should render category names', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

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
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Server error');
  });

  it('should show generic error when categories load fails without message', () => {
    categoriesService.getCategories.mockReturnValue(
      throwError(() => ({ error: {} }))
    );
    fixture.detectChanges();

    expect(component.categoriesError).toBe('Failed to load categories.');
  });

  it('should show empty state when no categories', () => {
    categoriesService.getCategories.mockReturnValue(of([]));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('No categories yet');
  });

  it('should add category to list when onCategoryCreated is called', () => {
    fixture.detectChanges();
    const newCat: CategoryDto = { id: 'cat-3', name: 'Food', color: '#a78bfa' };

    component.onCategoryCreated(newCat);

    expect(component.categories.length).toBe(3);
    expect(component.categories[2].name).toBe('Food');
  });

  it('should start editing a category', () => {
    fixture.detectChanges();
    const cat = component.categories[0];

    component.startEdit(cat);

    expect(component.editingId).toBe('cat-1');
    expect(component.editName).toBe('Streaming');
    expect(component.editColor).toBe('#FF0000');
  });

  it('should use default color when category has no color', () => {
    fixture.detectChanges();
    const cat: CategoryDto = { id: 'cat-x', name: 'NoColor' };

    component.startEdit(cat);

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

    expect(component.categories.length).toBe(2);

    component.deleteCategory(component.categories[0]);

    expect(categoriesService.deleteCategory).toHaveBeenCalledWith('cat-1');
    expect(component.categories.length).toBe(1);
    expect(component.categories[0].name).toBe('Insurance');
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
    expect(component.categories.length).toBe(2);
  });

  it('should show generic error on delete failure without message', () => {
    categoriesService.deleteCategory.mockReturnValue(
      throwError(() => ({ error: {} }))
    );
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

  it('should render the Import Transactions section header', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Import Transactions');
  });

  it('should render the Categories section header', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Categories');
  });
});
