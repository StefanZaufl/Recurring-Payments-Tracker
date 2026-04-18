package com.tracker.repository;

import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.service.IbanNormalizationService;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

import java.util.ArrayList;
import java.util.List;

public final class TransactionPredicates {

    private TransactionPredicates() {
    }

    public static List<Predicate> build(TransactionFilter filter, Root<Transaction> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        List<Predicate> predicates = new ArrayList<>();
        predicates.add(cb.equal(root.get("user").get("id"), filter.userId()));

        if (filter.from() != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("bookingDate"), filter.from()));
        }
        if (filter.to() != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("bookingDate"), filter.to()));
        }
        if (filter.text() != null && !filter.text().isBlank()) {
            String pattern = "%" + filter.text().toLowerCase() + "%";
            predicates.add(cb.or(
                    cb.like(cb.lower(root.get("partnerName")), pattern),
                    cb.like(cb.lower(root.get("details")), pattern)
            ));
        }
        if (filter.account() != null && !filter.account().isBlank()) {
            predicates.add(cb.equal(root.get("account"), IbanNormalizationService.normalize(filter.account())));
        }
        if (filter.transactionType() == TransactionTypeFilter.REGULAR || filter.transactionType() == TransactionTypeFilter.ADDITIONAL) {
            predicates.add(cb.isFalse(root.get("isInterAccount")));
            if (query == null) {
                throw new IllegalStateException("Transaction type filtering requires a criteria query");
            }

            var subquery = query.subquery(java.util.UUID.class);
            var linkRoot = subquery.from(TransactionRecurringLink.class);
            subquery.select(linkRoot.get("transaction").get("id"));
            subquery.where(cb.equal(linkRoot.get("transaction").get("id"), root.get("id")));

            predicates.add(filter.transactionType() == TransactionTypeFilter.REGULAR ? cb.exists(subquery) : cb.not(cb.exists(subquery)));
        }

        return predicates;
    }
}
