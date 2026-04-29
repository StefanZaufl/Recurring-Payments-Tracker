import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AdditionalRuleGroupEditorComponent } from './additional-rule-group-editor.component';
import { AdditionalRuleGroupsService, TransactionsService } from '../../api/generated';
import { TransactionPage } from '../../api/generated/model/transactionPage';

const emptyPage: TransactionPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  filteredSum: 0,
};

describe('AdditionalRuleGroupEditorComponent', () => {
  let fixture: ComponentFixture<AdditionalRuleGroupEditorComponent>;
  let component: AdditionalRuleGroupEditorComponent;

  beforeEach(async () => {
    const groupsServiceMock = {
      getAdditionalRuleGroups: jest.fn().mockReturnValue(of([])),
      simulateAdditionalRuleGroup: jest.fn(),
    };
    const transactionsServiceMock = {
      getTransactions: jest.fn().mockReturnValue(of(emptyPage)),
    };

    await TestBed.configureTestingModule({
      imports: [AdditionalRuleGroupEditorComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ new: 'true' })) },
        },
        provideRouter([]),
        { provide: AdditionalRuleGroupsService, useValue: groupsServiceMock },
        { provide: TransactionsService, useValue: transactionsServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdditionalRuleGroupEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render a warning for matches already excluded by other Additional groups', () => {
    component.overlappingAdditionalMatchCount = 2;
    component.overlappingAdditionalGroupNames = ['Ignore Amazon', 'Ignore PayPal'];

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Additional payment overlap detected');
    expect(text).toContain('2 matching transactions already excluded by other Additional rule groups');
    expect(text).toContain('Ignore Amazon');
    expect(text).toContain('Ignore PayPal');
  });
});
