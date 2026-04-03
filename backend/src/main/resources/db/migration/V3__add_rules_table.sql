-- Rules for recurring payment detection
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_payment_id UUID NOT NULL REFERENCES recurring_payments(id) ON DELETE CASCADE,
    rule_type VARCHAR(30) NOT NULL,
    target_field VARCHAR(30),
    text VARCHAR(500),
    strict BOOLEAN DEFAULT TRUE,
    threshold DOUBLE PRECISION,
    amount DECIMAL(12,2),
    fluctuation_range DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rules_recurring_payment ON rules(recurring_payment_id);

-- Migrate existing recurring payments to have default rules
-- JaroWinkler rule for partner name matching
INSERT INTO rules (recurring_payment_id, rule_type, target_field, text, strict, threshold)
SELECT id, 'JARO_WINKLER', 'PARTNER_NAME', normalized_name, TRUE, 0.85
FROM recurring_payments
WHERE normalized_name IS NOT NULL;

-- Amount rule with 10% fluctuation range
INSERT INTO rules (recurring_payment_id, rule_type, amount, fluctuation_range)
SELECT id, 'AMOUNT', average_amount, ABS(average_amount * 0.10)
FROM recurring_payments
WHERE average_amount IS NOT NULL;
