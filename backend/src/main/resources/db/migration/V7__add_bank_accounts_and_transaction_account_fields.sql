CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iban VARCHAR(34) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_bank_accounts_user_iban ON bank_accounts(user_id, iban);
CREATE INDEX idx_bank_accounts_user ON bank_accounts(user_id);

ALTER TABLE transactions
    ADD COLUMN account VARCHAR(34),
    ADD COLUMN is_inter_account BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_transactions_account ON transactions(account);
CREATE INDEX idx_transactions_inter_account ON transactions(is_inter_account);
