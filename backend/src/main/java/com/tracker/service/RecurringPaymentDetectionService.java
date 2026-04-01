package com.tracker.service;

import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import org.apache.commons.text.similarity.JaroWinklerSimilarity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecurringPaymentDetectionService {

    private static final Logger log = LoggerFactory.getLogger(RecurringPaymentDetectionService.class);

    static final double SIMILARITY_THRESHOLD = 0.85;
    static final int MIN_OCCURRENCES = 2;
    static final long MONTHLY_MIN_DAYS = 20;
    static final long MONTHLY_MAX_DAYS = 40;
    static final long QUARTERLY_MIN_DAYS = 75;
    static final long QUARTERLY_MAX_DAYS = 105;
    static final long YEARLY_MIN_DAYS = 340;
    static final long YEARLY_MAX_DAYS = 395;

    private final TransactionRepository transactionRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final JaroWinklerSimilarity jaroWinkler = new JaroWinklerSimilarity();

    public RecurringPaymentDetectionService(TransactionRepository transactionRepository,
                                            RecurringPaymentRepository recurringPaymentRepository,
                                            TransactionRecurringLinkRepository linkRepository) {
        this.transactionRepository = transactionRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.linkRepository = linkRepository;
    }

    @Transactional
    public List<RecurringPayment> detectRecurringPayments() {
        List<Transaction> allTransactions = transactionRepository.findAll();
        if (allTransactions.isEmpty()) {
            return List.of();
        }

        // Clear existing detected patterns and links
        linkRepository.deleteAll();
        recurringPaymentRepository.deleteAll();

        // Group transactions by similar partner names
        List<TransactionGroup> groups = groupTransactionsByPartner(allTransactions);

        List<RecurringPayment> detectedPayments = new ArrayList<>();
        for (TransactionGroup group : groups) {
            if (group.transactions().size() < MIN_OCCURRENCES) {
                continue;
            }

            String frequency = detectFrequency(group.transactions());
            if (frequency == null) {
                continue;
            }

            RecurringPayment payment = createRecurringPayment(group, frequency);
            payment = recurringPaymentRepository.save(payment);

            for (Transaction tx : group.transactions()) {
                TransactionRecurringLink link = new TransactionRecurringLink();
                link.setTransaction(tx);
                link.setRecurringPayment(payment);
                link.setConfidenceScore(BigDecimal.valueOf(
                        jaroWinkler.apply(normalize(tx.getPartnerName()), payment.getNormalizedName()))
                        .setScale(2, RoundingMode.HALF_UP));
                linkRepository.save(link);
            }

            detectedPayments.add(payment);
        }

        log.info("Detected {} recurring payments from {} transactions", detectedPayments.size(), allTransactions.size());
        return detectedPayments;
    }

    List<TransactionGroup> groupTransactionsByPartner(List<Transaction> transactions) {
        List<TransactionGroup> groups = new ArrayList<>();

        for (Transaction tx : transactions) {
            if (tx.getPartnerName() == null || tx.getPartnerName().isBlank()) {
                continue;
            }

            String normalized = normalize(tx.getPartnerName());
            boolean matched = false;

            for (TransactionGroup group : groups) {
                if (jaroWinkler.apply(normalized, group.normalizedName()) >= SIMILARITY_THRESHOLD) {
                    group.transactions().add(tx);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                List<Transaction> groupTransactions = new ArrayList<>();
                groupTransactions.add(tx);
                groups.add(new TransactionGroup(tx.getPartnerName(), normalized, groupTransactions));
            }
        }

        return groups;
    }

    String detectFrequency(List<Transaction> transactions) {
        if (transactions.size() < MIN_OCCURRENCES) {
            return null;
        }

        List<Long> gaps = computeDayGaps(transactions);
        if (gaps.isEmpty()) {
            return null;
        }

        long medianGap = median(gaps);

        if (medianGap >= MONTHLY_MIN_DAYS && medianGap <= MONTHLY_MAX_DAYS) {
            return "MONTHLY";
        } else if (medianGap >= QUARTERLY_MIN_DAYS && medianGap <= QUARTERLY_MAX_DAYS) {
            return "QUARTERLY";
        } else if (medianGap >= YEARLY_MIN_DAYS && medianGap <= YEARLY_MAX_DAYS) {
            return "YEARLY";
        }

        return null;
    }

    List<Long> computeDayGaps(List<Transaction> transactions) {
        List<LocalDate> dates = transactions.stream()
                .map(Transaction::getBookingDate)
                .sorted()
                .toList();

        List<Long> gaps = new ArrayList<>();
        for (int i = 1; i < dates.size(); i++) {
            gaps.add(ChronoUnit.DAYS.between(dates.get(i - 1), dates.get(i)));
        }
        return gaps;
    }

    static long median(List<Long> values) {
        List<Long> sorted = values.stream().sorted().toList();
        int size = sorted.size();
        if (size % 2 == 0) {
            return (sorted.get(size / 2 - 1) + sorted.get(size / 2)) / 2;
        }
        return sorted.get(size / 2);
    }

    static String normalize(String input) {
        if (input == null) {
            return "";
        }
        return input.toLowerCase(Locale.GERMAN)
                .replaceAll("[^a-zäöüß0-9\\s]", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private RecurringPayment createRecurringPayment(TransactionGroup group, String frequency) {
        BigDecimal avgAmount = group.transactions().stream()
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(group.transactions().size()), 2, RoundingMode.HALF_UP);

        boolean isIncome = avgAmount.compareTo(BigDecimal.ZERO) > 0;

        RecurringPayment payment = new RecurringPayment();
        payment.setName(group.representativeName());
        payment.setNormalizedName(group.normalizedName());
        payment.setAverageAmount(avgAmount);
        payment.setFrequency(frequency);
        payment.setIsIncome(isIncome);
        payment.setIsActive(true);
        return payment;
    }

    record TransactionGroup(String representativeName, String normalizedName, List<Transaction> transactions) {}
}
