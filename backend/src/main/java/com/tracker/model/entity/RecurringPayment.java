package com.tracker.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "recurring_payments")
@Getter
@Setter
@NoArgsConstructor
public class RecurringPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "normalized_name")
    private String normalizedName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(name = "average_amount", precision = 12, scale = 2)
    private BigDecimal averageAmount;

    @Column(length = 20)
    private String frequency;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_type", length = 20, nullable = false)
    private PaymentType paymentType = PaymentType.RECURRING;

    @Column(name = "is_income")
    private Boolean isIncome = false;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @OneToMany(mappedBy = "recurringPayment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Rule> rules = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;
}
