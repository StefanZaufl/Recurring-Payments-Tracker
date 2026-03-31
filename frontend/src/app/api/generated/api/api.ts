export * from './analytics.service';
import { AnalyticsService } from './analytics.service';
export * from './recurringPayments.service';
import { RecurringPaymentsService } from './recurringPayments.service';
export * from './transactions.service';
import { TransactionsService } from './transactions.service';
export const APIS = [AnalyticsService, RecurringPaymentsService, TransactionsService];
