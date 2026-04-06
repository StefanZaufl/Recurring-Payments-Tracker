import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { FileUploadZoneComponent } from './file-upload-zone.component';
import { TransactionsService } from '../api/generated';
import { UploadResponse } from '../api/generated/model/uploadResponse';

const mockUploadResponse: UploadResponse = {
  uploadId: 'abc-123',
  transactionCount: 42,
  skippedDuplicates: 3,
  recurringPaymentsDetected: 5,
};

describe('FileUploadZoneComponent', () => {
  let component: FileUploadZoneComponent;
  let fixture: ComponentFixture<FileUploadZoneComponent>;
  let transactionsService: jest.Mocked<TransactionsService>;

  beforeEach(async () => {
    const transactionsServiceMock = {
      uploadCsv: jest.fn().mockReturnValue(of(mockUploadResponse)),
    };

    await TestBed.configureTestingModule({
      imports: [FileUploadZoneComponent],
      providers: [
        provideRouter([]),
        { provide: TransactionsService, useValue: transactionsServiceMock },
      ],
    })
    .overrideComponent(FileUploadZoneComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    transactionsService = TestBed.inject(TransactionsService) as jest.Mocked<TransactionsService>;
    fixture = TestBed.createComponent(FileUploadZoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render upload area', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Drag & drop your CSV file');
    expect(el.textContent).toContain('click to browse');
  });

  it('should not show result or error initially', () => {
    expect(component.result).toBeNull();
    expect(component.error).toBeNull();
    expect(component.uploading).toBe(false);
  });

  it('should upload file on file selection', () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const event = { target: { files: [file] } } as unknown as Event;

    component.onFileSelected(event);

    expect(transactionsService.uploadCsv).toHaveBeenCalledWith(
      file,
      JSON.stringify({
        bookingDate: 'Buchungsdatum',
        amount: 'Betrag',
        partnerName: 'Partnername',
        details: 'Buchungs-Details'
      })
    );
    expect(component.result).toEqual(mockUploadResponse);
    expect(component.uploading).toBe(false);
  });

  it('should emit uploaded event on success', () => {
    const spy = jest.fn();
    component.uploaded.subscribe(spy);

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    expect(spy).toHaveBeenCalledWith(mockUploadResponse);
  });

  it('should show success message after upload', () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Upload successful');
    expect(el.textContent).toContain('42');
    expect(el.textContent).toContain('transactions imported');
    expect(el.textContent).toContain('3');
    expect(el.textContent).toContain('duplicates skipped');
    expect(el.textContent).toContain('5');
    expect(el.textContent).toContain('recurring payments detected');
  });

  it('should show error message on upload failure', () => {
    transactionsService.uploadCsv.mockReturnValue(
      throwError(() => ({ error: { message: 'Invalid CSV format' } }))
    );

    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(component.error).toBe('Invalid CSV format');
    expect(el.textContent).toContain('Invalid CSV format');
    expect(component.result).toBeNull();
  });

  it('should show generic error when no message in response', () => {
    transactionsService.uploadCsv.mockReturnValue(
      throwError(() => ({ error: {} }))
    );

    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    expect(component.error).toBe('Upload failed. Please try again.');
  });

  it('should handle drag over', () => {
    const event = { preventDefault: jest.fn() } as unknown as DragEvent;
    component.onDragOver(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragging).toBe(true);
  });

  it('should handle drop with file', () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const event = {
      preventDefault: jest.fn(),
      dataTransfer: { files: [file] },
    } as unknown as DragEvent;

    component.onDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragging).toBe(false);
    expect(transactionsService.uploadCsv).toHaveBeenCalledWith(
      file,
      JSON.stringify({
        bookingDate: 'Buchungsdatum',
        amount: 'Betrag',
        partnerName: 'Partnername',
        details: 'Buchungs-Details'
      })
    );
  });

  it('should handle drop without file', () => {
    const event = {
      preventDefault: jest.fn(),
      dataTransfer: { files: [] },
    } as unknown as DragEvent;

    component.onDrop(event);

    expect(component.isDragging).toBe(false);
    expect(transactionsService.uploadCsv).not.toHaveBeenCalled();
  });

  it('should reset result and error before new upload', () => {
    component.result = mockUploadResponse;
    component.error = 'old error';

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    expect(component.error).toBeNull();
    expect(component.result).toEqual(mockUploadResponse);
  });

  it('should ignore file selection when no file chosen', () => {
    const event = { target: { files: [] } } as unknown as Event;
    component.onFileSelected(event);

    expect(transactionsService.uploadCsv).not.toHaveBeenCalled();
  });
});
