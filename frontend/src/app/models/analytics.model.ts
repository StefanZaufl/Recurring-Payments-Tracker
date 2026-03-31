export interface AnnualOverview {
  totalIncome: number;
  totalExpenses: number;
  totalRecurringExpenses: number;
  monthlyBreakdown: MonthlyBreakdown[];
  byCategory: CategoryBreakdown[];
  recurringPayments: RecurringPaymentSummary[];
}

export interface MonthlyBreakdown {
  month: number;
  income: number;
  expenses: number;
  surplus: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
}

export interface RecurringPaymentSummary {
  name: string;
  monthlyAmount: number;
  annualAmount: number;
  category: string;
}

export interface PredictionResponse {
  predictions: MonthlyPrediction[];
  upcomingPayments: UpcomingPayment[];
}

export interface MonthlyPrediction {
  month: string;
  expectedIncome: number;
  expectedExpenses: number;
  expectedSurplus: number;
}

export interface UpcomingPayment {
  name: string;
  date: string;
  amount: number;
}
