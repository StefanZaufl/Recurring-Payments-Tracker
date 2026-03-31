export interface Transaction {
  id: string;
  uploadId: string;
  bookingDate: string;
  partnerName: string;
  partnerIban: string;
  amount: number;
  currency: string;
  details: string;
  createdAt: string;
}

export interface TransactionPage {
  content: Transaction[];
  totalElements: number;
  totalPages: number;
}

export interface UploadResponse {
  uploadId: string;
  transactionCount: number;
  recurringPaymentsDetected: number;
}
