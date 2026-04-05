package com.tracker.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "rules")
@Getter
@Setter
@NoArgsConstructor
public class Rule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurring_payment_id", nullable = false)
    private RecurringPayment recurringPayment;

    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type", nullable = false, length = 30)
    private RuleType ruleType;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_field", length = 30)
    private TargetField targetField;

    @Column(length = 500)
    private String text;

    private Boolean strict = true;

    private Double threshold;

    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "fluctuation_range", precision = 12, scale = 2)
    private BigDecimal fluctuationRange;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;
}
