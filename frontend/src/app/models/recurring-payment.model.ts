export interface RecurringPayment {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  averageAmount: number;
  frequency: string;
  isIncome: boolean;
  isActive: boolean;
}
