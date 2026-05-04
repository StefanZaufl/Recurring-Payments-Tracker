package com.tracker.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class DataMigrationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataMigrationRunner.class);

    private final RecurringPaymentLifecycleDateBackfillService lifecycleDateBackfillService;

    public DataMigrationRunner(RecurringPaymentLifecycleDateBackfillService lifecycleDateBackfillService) {
        this.lifecycleDateBackfillService = lifecycleDateBackfillService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void runDataMigrations() {
        try {
            int processedPayments = lifecycleDateBackfillService.backfillOnce();
            if (processedPayments > 0) {
                log.info("Backfilled recurring payment lifecycle dates for {} payments", processedPayments);
            }
        } catch (Exception e) {
            log.error("Failed to backfill recurring payment lifecycle dates: " + e.getMessage(), e);
        }
    }
}
