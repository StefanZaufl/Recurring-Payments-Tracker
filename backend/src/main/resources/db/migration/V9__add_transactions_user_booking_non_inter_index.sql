CREATE INDEX idx_transactions_user_booking_non_inter
    ON transactions (user_id, booking_date DESC)
    WHERE is_inter_account = FALSE;
