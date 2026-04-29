CREATE TABLE additional_rule_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    normalized_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT additional_rule_groups_user_name_unique UNIQUE (user_id, normalized_name)
);

CREATE INDEX idx_additional_rule_groups_user_id ON additional_rule_groups(user_id);

ALTER TABLE rules ADD COLUMN additional_rule_group_id UUID REFERENCES additional_rule_groups(id) ON DELETE CASCADE;
ALTER TABLE rules ALTER COLUMN recurring_payment_id DROP NOT NULL;

ALTER TABLE rules ADD CONSTRAINT rules_exactly_one_parent CHECK (
    (recurring_payment_id IS NOT NULL AND additional_rule_group_id IS NULL)
    OR (recurring_payment_id IS NULL AND additional_rule_group_id IS NOT NULL)
);

CREATE INDEX idx_rules_additional_rule_group ON rules(additional_rule_group_id);
