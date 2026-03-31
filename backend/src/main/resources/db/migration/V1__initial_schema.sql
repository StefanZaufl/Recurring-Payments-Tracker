-- Uploaded CSV files metadata
CREATE TABLE csv_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    row_count INTEGER
);

-- Raw transactions from CSV
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES csv_uploads(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    partner_name VARCHAR(255),
    partner_iban VARCHAR(34),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories for grouping
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7)
);

-- Detected recurring payment patterns
CREATE TABLE recurring_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    average_amount DECIMAL(12,2),
    frequency VARCHAR(20),
    is_income BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link transactions to recurring payments
CREATE TABLE transaction_recurring_link (
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    recurring_payment_id UUID REFERENCES recurring_payments(id) ON DELETE CASCADE,
    confidence_score DECIMAL(3,2),
    PRIMARY KEY (transaction_id, recurring_payment_id)
);

-- Indexes for performance
CREATE INDEX idx_transactions_booking_date ON transactions(booking_date);
CREATE INDEX idx_transactions_partner_name ON transactions(partner_name);
CREATE INDEX idx_transactions_details ON transactions(details);
CREATE INDEX idx_recurring_payments_name ON recurring_payments(normalized_name);
CREATE INDEX idx_recurring_payments_category ON recurring_payments(category_id);
