ALTER TABLE recurring_payments ADD COLUMN payment_type VARCHAR(20) NOT NULL DEFAULT 'RECURRING';
CREATE INDEX idx_recurring_payments_payment_type ON recurring_payments(payment_type);
