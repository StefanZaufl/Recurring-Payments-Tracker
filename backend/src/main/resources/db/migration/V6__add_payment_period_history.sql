CREATE TABLE payment_period_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_payment_id UUID NOT NULL REFERENCES recurring_payments(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_payment_period UNIQUE (recurring_payment_id, period_start)
);

CREATE INDEX idx_period_history_payment_id ON payment_period_history(recurring_payment_id);
CREATE INDEX idx_period_history_user_id ON payment_period_history(user_id);
