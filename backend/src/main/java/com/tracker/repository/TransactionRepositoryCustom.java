package com.tracker.repository;

import java.math.BigDecimal;

public interface TransactionRepositoryCustom {

    BigDecimal sumAmounts(TransactionFilter filter);
}
