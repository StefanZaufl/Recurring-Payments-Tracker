package com.tracker.repository;

import com.tracker.model.entity.Transaction;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;

@Repository
class TransactionRepositoryImpl implements TransactionRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public BigDecimal sumAmounts(TransactionFilter filter) {
        CriteriaQuery<BigDecimal> query = entityManager.getCriteriaBuilder().createQuery(BigDecimal.class);
        Root<Transaction> root = query.from(Transaction.class);
        var cb = entityManager.getCriteriaBuilder();

        query.select(cb.coalesce(cb.sum(root.get("amount")), BigDecimal.ZERO));
        query.where(TransactionPredicates.build(filter, root, query, cb).toArray(new jakarta.persistence.criteria.Predicate[0]));

        return entityManager.createQuery(query).getSingleResult();
    }
}
