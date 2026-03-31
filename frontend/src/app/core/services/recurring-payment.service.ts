import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { RecurringPayment } from '../../models/recurring-payment.model';
import { Transaction } from '../../models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class RecurringPaymentService {
  constructor(private api: ApiService) {}

  getAll(): Observable<RecurringPayment[]> {
    return this.api.http.get<RecurringPayment[]>(`${this.api.baseUrl}/recurring-payments`);
  }

  update(id: string, data: Partial<RecurringPayment>): Observable<RecurringPayment> {
    return this.api.http.put<RecurringPayment>(`${this.api.baseUrl}/recurring-payments/${id}`, data);
  }

  getTransactions(id: string): Observable<Transaction[]> {
    return this.api.http.get<Transaction[]>(`${this.api.baseUrl}/recurring-payments/${id}/transactions`);
  }
}
