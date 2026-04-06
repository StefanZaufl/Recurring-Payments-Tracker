import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FileUploadComponent } from './file-upload.component';
import { TransactionsService } from '../../api/generated';
import { of } from 'rxjs';

describe('FileUploadComponent', () => {
  let component: FileUploadComponent;
  let fixture: ComponentFixture<FileUploadComponent>;

  beforeEach(async () => {
    const transactionsServiceMock = {
      uploadCsv: jest.fn().mockReturnValue(of({
        uploadId: 'abc-123',
        transactionCount: 42,
        skippedDuplicates: 0,
        recurringPaymentsDetected: 5,
      })),
    };

    await TestBed.configureTestingModule({
      imports: [FileUploadComponent],
      providers: [
        provideRouter([]),
        { provide: TransactionsService, useValue: transactionsServiceMock },
      ],
    })
    .overrideComponent(FileUploadComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render page heading', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Upload');
    expect(el.textContent).toContain('Import your bank CSV export');
  });

  it('should render the file upload zone child component', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-file-upload-zone')).toBeTruthy();
  });
});
