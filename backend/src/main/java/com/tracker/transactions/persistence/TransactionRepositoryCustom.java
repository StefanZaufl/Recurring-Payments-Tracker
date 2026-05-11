package com.tracker.transactions.persistence;

import java.math.BigDecimal;

public interface TransactionRepositoryCustom {

    BigDecimal sumAmounts(TransactionFilter filter);
}
