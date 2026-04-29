package com.tracker.service;

import com.tracker.controller.ResourceNotFoundException;
import com.tracker.model.entity.*;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.RuleRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
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

    static final double DEFAULT_SIMILARITY_THRESHOLD = 0.85;
    static final int MIN_OCCURRENCES = 2;
    static final long MONTHLY_MIN_DAYS = 20;
    static final long MONTHLY_MAX_DAYS = 40;
    static final long QUARTERLY_MIN_DAYS = 75;
    static final long QUARTERLY_MAX_DAYS = 105;
    static final long YEARLY_MIN_DAYS = 340;
    static final long YEARLY_MAX_DAYS = 395;
    static final int LOOKBACK_DAYS = 730;
    static final int MONTHLY_STALE_GRACE_DAYS = 15;
    static final int QUARTERLY_STALE_GRACE_DAYS = 45;
    static final int YEARLY_STALE_GRACE_DAYS = 60;

    private final TransactionRepository transactionRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final RuleRepository ruleRepository;
    private final RuleEvaluationService ruleEvaluationService;
    private final UserContextService userContextService;
    private final PaymentPeriodHistoryService historyService;
    private final AdditionalMatchingService additionalMatchingService;

    public RecurringPaymentDetectionService(TransactionRepository transactionRepository,
                                            RecurringPaymentRepository recurringPaymentRepository,
                                            TransactionRecurringLinkRepository linkRepository,
                                            RuleRepository ruleRepository,
                                            RuleEvaluationService ruleEvaluationService,
                                            UserContextService userContextService,
                                            PaymentPeriodHistoryService historyService,
                                            AdditionalMatchingService additionalMatchingService) {
        this.transactionRepository = transactionRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.linkRepository = linkRepository;
        this.ruleRepository = ruleRepository;
        this.ruleEvaluationService = ruleEvaluationService;
        this.userContextService = userContextService;
        this.historyService = historyService;
        this.additionalMatchingService = additionalMatchingService;
    }

    /**
     * Incremental detection: matches new transactions against existing RTs,
     * then tries to form new RTs from unmatched transactions.
     */
    @Transactional
    public List<RecurringPayment> detectRecurringPayments(List<Transaction> newTransactions) {
        log.info("Starting detection with {} new transactions", newTransactions.size());
        if (newTransactions.isEmpty()) {
            return List.of();
        }

        List<RecurringPayment> result = new ArrayList<>();
        List<Transaction> eligibleNewTransactions = additionalMatchingService.filterExcluded(newTransactions);
        List<Transaction> unmatched = new ArrayList<>(eligibleNewTransactions);

        // Step 1a: Match against existing active RECURRING payments (higher priority)
        UUID currentUserId = userContextService.getCurrentUserId();
        List<RecurringPayment> recurringRts = recurringPaymentRepository
                .findByUserIdAndIsActiveTrueAndPaymentType(currentUserId, PaymentType.RECURRING);
        log.info("Step 1a: Matching against {} active RECURRING payments", recurringRts.size());
        matchExistingPayments(recurringRts, unmatched, result);

        // Step 1b: Match against existing active GROUPED payments (lower priority)
        List<RecurringPayment> groupedRts = recurringPaymentRepository
                .findByUserIdAndIsActiveTrueAndPaymentType(currentUserId, PaymentType.GROUPED);
        log.info("Step 1b: Matching against {} active GROUPED payments", groupedRts.size());
        matchExistingPayments(groupedRts, unmatched, result);

        // Step 1c: Recalculate average amounts for all active GROUPED payments
        recalculateGroupedAverages(groupedRts);

        // Step 2: Try to form new RTs from unmatched transactions
        log.info("Step 2: {} unmatched transactions remain, attempting to form new RTs", unmatched.size());
        LocalDate cutoff = LocalDate.now().minusDays(LOOKBACK_DAYS);
        Set<UUID> newTransactionIds = eligibleNewTransactions.stream()
                .map(Transaction::getId).collect(Collectors.toSet());
        List<Transaction> oldUnlinked = transactionRepository.findUnlinkedTransactionsAfterForUser(cutoff, currentUserId)
                .stream()
                .filter(tx -> !newTransactionIds.contains(tx.getId()))
                .collect(Collectors.toCollection(ArrayList::new));
        oldUnlinked = new ArrayList<>(additionalMatchingService.filterExcluded(oldUnlinked));
        log.debug("Found {} old unlinked transactions (cutoff={}, excluded {} new)", oldUnlinked.size(), cutoff, newTransactionIds.size());

        List<Transaction> toProcess = new ArrayList<>(unmatched);
        for (Transaction tx : toProcess) {
            if (!unmatched.contains(tx)) {
                continue;
            }
            if (tx.getPartnerName() == null || tx.getPartnerName().isBlank()) {
                log.debug("Skipping transaction {} — no partner name", tx.getId());
                continue;
            }

            List<Rule> transientRules = createTransientRules(tx);
            log.debug("Created transient rules for '{}' (amount={}): {}", tx.getPartnerName(), tx.getAmount(),
                    transientRules.stream().map(r -> r.getRuleType().name() + "(" +
                            (r.getText() != null ? "text=" + r.getText() : "amount=" + r.getAmount()) + ")").toList());

            List<Transaction> candidates = new ArrayList<>(oldUnlinked);
            for (Transaction u : unmatched) {
                if (!u.getId().equals(tx.getId())) {
                    candidates.add(u);
                }
            }
            log.debug("Evaluating {} candidates for '{}'", candidates.size(), tx.getPartnerName());

            List<Transaction> additionalMatches = ruleEvaluationService.findMatchingTransactions(transientRules, candidates);

            if (!additionalMatches.isEmpty()) {
                List<Transaction> allMatched = new ArrayList<>();
                allMatched.add(tx);
                allMatched.addAll(additionalMatches);

                Frequency frequency = detectFrequency(allMatched);
                log.debug("'{}': {} total matches, detected frequency={}", tx.getPartnerName(),
                        allMatched.size(), frequency);
                if (frequency != null) {
                    RecurringPayment rt = createAndPersistRecurringPayment(tx, allMatched, transientRules, frequency);
                    result.add(rt);
                    unmatched.removeAll(allMatched);
                    oldUnlinked.removeAll(additionalMatches);
                    log.info("Created new RT '{}' ({}) with {} transactions", rt.getName(), frequency, allMatched.size());
                } else {
                    log.debug("'{}': no valid frequency detected from {} matches — skipping", tx.getPartnerName(), allMatched.size());
                }
            } else {
                log.debug("'{}': no additional matches found", tx.getPartnerName());
            }
        }

        log.info("Detection complete: {} RTs updated/created from {} new transactions ({} unmatched)",
                result.size(), newTransactions.size(), unmatched.size());
        return result;
    }

    private void matchExistingPayments(List<RecurringPayment> payments,
                                       List<Transaction> unmatched,
                                       List<RecurringPayment> result) {
        for (RecurringPayment rt : payments) {
            List<Rule> rules = rt.getRules();
            log.debug("RT '{}' (id={}) has {} rules: {}", rt.getName(), rt.getId(), rules.size(),
                    rules.stream().map(r -> r.getRuleType().name()).toList());
            if (rules.isEmpty()) {
                log.debug("Skipping RT '{}' — no rules", rt.getName());
                continue;
            }

            List<Transaction> matched = ruleEvaluationService.findMatchingTransactions(rules, unmatched);
            if (!matched.isEmpty()) {
                log.info("RT '{}': matched {} new transactions", rt.getName(), matched.size());
                for (Transaction tx : matched) {
                    createLink(tx, rt);
                }
                updateAmountRuleToNewest(rules, matched);
                recomputeAverageAmount(rt);
                refreshLifecycleDates(rt, getLinkedTransactionsWithAdditional(rt.getId(), matched));
                historyService.recomputeHistory(rt);
                BigDecimal rollingAvg = historyService.getRollingAverage(rt.getId(), 4);
                if (rollingAvg != null) {
                    rt.setAverageAmount(rollingAvg);
                    rt.setIsIncome(rollingAvg.compareTo(BigDecimal.ZERO) > 0);
                }
                recurringPaymentRepository.save(rt);
                unmatched.removeAll(matched);
                result.add(rt);
            } else {
                log.debug("RT '{}': no matches among {} unmatched transactions", rt.getName(), unmatched.size());
            }
        }
    }

    private void recalculateGroupedAverages(List<RecurringPayment> groupedPayments) {
        for (RecurringPayment rt : groupedPayments) {
            historyService.recomputeHistory(rt);
            BigDecimal rollingAvg = historyService.getRollingAverage(rt.getId(), 4);
            if (rollingAvg != null) {
                rt.setAverageAmount(rollingAvg);
                rt.setIsIncome(rollingAvg.compareTo(BigDecimal.ZERO) > 0);
                recurringPaymentRepository.save(rt);
                log.debug("Recalculated grouped payment '{}' rolling average to {}", rt.getName(), rollingAvg);
            }
        }
    }

    /**
     * Re-evaluates an existing RT against unlinked transactions.
     * Only adds new transactions, never removes existing ones.
     */
    @Transactional
    public RecurringPayment reEvaluateRecurringPayment(UUID recurringPaymentId) {
        UUID currentUserId = userContextService.getCurrentUserId();
        RecurringPayment rt = recurringPaymentRepository.findByIdAndUserId(recurringPaymentId, currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Recurring payment not found: " + recurringPaymentId));

        List<Rule> rules = ruleRepository.findByRecurringPaymentIdAndUserId(recurringPaymentId, currentUserId);
        if (rules.isEmpty()) {
            return rt;
        }

        Set<UUID> alreadyLinkedIds = linkRepository.findWithTransactionByRecurringPaymentIdAndUserId(recurringPaymentId, currentUserId)
                .stream().map(link -> link.getTransaction().getId()).collect(Collectors.toSet());

        LocalDate cutoff = LocalDate.now().minusDays(LOOKBACK_DAYS);
        List<Transaction> candidates = additionalMatchingService.filterExcluded(
                transactionRepository.findUnlinkedTransactionsAfterForUser(cutoff, currentUserId));

        List<Transaction> newMatches = ruleEvaluationService.findMatchingTransactions(rules, candidates)
                .stream().filter(tx -> !alreadyLinkedIds.contains(tx.getId())).toList();

        for (Transaction tx : newMatches) {
            createLink(tx, rt);
        }

        if (!newMatches.isEmpty()) {
            recomputeAverageAmount(rt);

            // Recompute frequency from the full linked set before rebuilding period history.
            List<Transaction> allTxs = getAllLinkedTransactions(recurringPaymentId);
            Frequency freq = detectFrequency(allTxs);
            if (freq != null) {
                rt.setFrequency(freq);
            }

            refreshLifecycleDates(rt, allTxs);
            historyService.recomputeHistory(rt);
            updateRollingAverageFromHistory(rt);
            recurringPaymentRepository.save(rt);
        }

        return rt;
    }

    @Transactional
    public void rebuildRecurringPayment(RecurringPayment recurringPayment, List<Transaction> matchedTransactions) {
        linkRepository.deleteByRecurringPaymentId(recurringPayment.getId());

        if (matchedTransactions.isEmpty()) {
            historyService.recomputeHistory(recurringPayment);
            return;
        }

        for (Transaction tx : matchedTransactions) {
            createLink(tx, recurringPayment);
        }

        updateAmountRuleToNewest(recurringPayment.getRules(), matchedTransactions);
        recomputeAverageAmount(recurringPayment);
        refreshLifecycleDates(recurringPayment, matchedTransactions);

        Frequency frequency = detectFrequency(matchedTransactions);
        if (frequency != null) {
            recurringPayment.setFrequency(frequency);
        }

        historyService.recomputeHistory(recurringPayment);
        updateRollingAverageFromHistory(recurringPayment);
        recurringPaymentRepository.save(recurringPayment);
    }

    private List<Transaction> getAllLinkedTransactions(UUID recurringPaymentId) {
        return linkRepository.findWithTransactionByRecurringPaymentId(recurringPaymentId)
                .stream().map(TransactionRecurringLink::getTransaction)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private List<Transaction> getLinkedTransactionsWithAdditional(UUID recurringPaymentId, List<Transaction> additionalTransactions) {
        List<Transaction> transactions = getAllLinkedTransactions(recurringPaymentId);
        transactions.addAll(additionalTransactions);
        return transactions;
    }

    void refreshLifecycleDates(RecurringPayment payment, List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return;
        }
        LocalDate firstLinkedDate = transactions.stream()
                .map(Transaction::getBookingDate)
                .min(LocalDate::compareTo)
                .orElse(null);
        LocalDate lastLinkedDate = transactions.stream()
                .map(Transaction::getBookingDate)
                .max(LocalDate::compareTo)
                .orElse(null);

        payment.setStartDate(firstLinkedDate);
        if (payment.getEndDate() != null && lastLinkedDate != null && lastLinkedDate.isAfter(payment.getEndDate())) {
            payment.setEndDate(null);
        }
    }

    @Transactional
    public void markStalePayments(LocalDate referenceDate) {
        if (referenceDate == null) {
            return;
        }
        UUID currentUserId = userContextService.getCurrentUserId();
        List<RecurringPayment> activePayments = recurringPaymentRepository.findByUserIdAndIsActiveTrue(currentUserId);
        for (RecurringPayment payment : activePayments) {
            if (payment.getEndDate() == null && payment.getFrequency() != null) {
                List<Transaction> linkedTransactions = getAllLinkedTransactions(payment.getId());
                if (!linkedTransactions.isEmpty()) {
                    refreshLifecycleDates(payment, linkedTransactions);
                    LocalDate lastLinkedDate = linkedTransactions.stream()
                            .map(Transaction::getBookingDate)
                            .max(LocalDate::compareTo)
                            .orElse(null);
                    if (isStale(lastLinkedDate, payment.getFrequency(), referenceDate)) {
                        payment.setEndDate(lastLinkedDate);
                    }
                    recurringPaymentRepository.save(payment);
                }
            }
        }
    }

    boolean isStale(LocalDate lastLinkedDate, Frequency frequency, LocalDate referenceDate) {
        if (lastLinkedDate == null || frequency == null || referenceDate == null) {
            return false;
        }
        return referenceDate.isAfter(staleDeadline(lastLinkedDate, frequency));
    }

    LocalDate staleDeadline(LocalDate lastLinkedDate, Frequency frequency) {
        return switch (frequency) {
            case MONTHLY -> lastLinkedDate.plusMonths(1).plusDays(MONTHLY_STALE_GRACE_DAYS);
            case QUARTERLY -> lastLinkedDate.plusMonths(3).plusDays(QUARTERLY_STALE_GRACE_DAYS);
            case YEARLY -> lastLinkedDate.plusYears(1).plusDays(YEARLY_STALE_GRACE_DAYS);
        };
    }

    private void createLink(Transaction tx, RecurringPayment rt) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(tx);
        link.setRecurringPayment(rt);
        link.setConfidenceScore(BigDecimal.ONE.setScale(2, RoundingMode.HALF_UP));
        link.setUser(userContextService.getCurrentUser());
        linkRepository.save(link);
    }

    private void updateAmountRuleToNewest(List<Rule> rules, List<Transaction> matched) {
        Transaction newest = matched.stream()
                .max(Comparator.comparing(Transaction::getBookingDate))
                .orElse(null);
        if (newest == null) return;

        rules.stream()
                .filter(r -> r.getRuleType() == RuleType.AMOUNT)
                .forEach(r -> {
                    r.setAmount(newest.getAmount());
                    ruleRepository.save(r);
                });
    }

    private void recomputeAverageAmount(RecurringPayment rt) {
        List<TransactionRecurringLink> links = linkRepository.findWithTransactionByRecurringPaymentId(rt.getId());
        if (links.isEmpty()) return;

        BigDecimal sum = links.stream()
                .map(link -> link.getTransaction().getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        rt.setAverageAmount(sum.divide(BigDecimal.valueOf(links.size()), 2, RoundingMode.HALF_UP));
        rt.setIsIncome(rt.getAverageAmount().compareTo(BigDecimal.ZERO) > 0);
    }

    private void updateRollingAverageFromHistory(RecurringPayment rt) {
        BigDecimal rollingAvg = historyService.getRollingAverage(rt.getId(), 4);
        if (rollingAvg != null) {
            rt.setAverageAmount(rollingAvg);
            rt.setIsIncome(rollingAvg.compareTo(BigDecimal.ZERO) > 0);
        }
    }

    private List<Rule> createTransientRules(Transaction tx) {
        Rule jwRule = new Rule();
        jwRule.setRuleType(RuleType.JARO_WINKLER);
        jwRule.setTargetField(TargetField.PARTNER_NAME);
        jwRule.setText(normalize(tx.getPartnerName()));
        jwRule.setThreshold(DEFAULT_SIMILARITY_THRESHOLD);
        jwRule.setStrict(true);

        Rule amountRule = new Rule();
        amountRule.setRuleType(RuleType.AMOUNT);
        amountRule.setAmount(tx.getAmount());
        amountRule.setFluctuationRange(tx.getAmount().abs()
                .multiply(BigDecimal.valueOf(0.10))
                .setScale(2, RoundingMode.HALF_UP));

        if (tx.getAccount() == null || tx.getAccount().isBlank()) {
            return List.of(jwRule, amountRule);
        }

        Rule accountRule = new Rule();
        accountRule.setRuleType(RuleType.REGEX);
        accountRule.setTargetField(TargetField.ACCOUNT);
        accountRule.setText("^\\Q" + tx.getAccount() + "\\E$");
        accountRule.setStrict(true);

        return List.of(jwRule, amountRule, accountRule);
    }

    private RecurringPayment createAndPersistRecurringPayment(Transaction representative,
                                                               List<Transaction> allMatched,
                                                               List<Rule> transientRules,
                                                               Frequency frequency) {
        BigDecimal avgAmount = allMatched.stream()
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(allMatched.size()), 2, RoundingMode.HALF_UP);

        com.tracker.model.entity.User currentUser = userContextService.getCurrentUser();
        RecurringPayment rt = new RecurringPayment();
        rt.setName(representative.getPartnerName());
        rt.setNormalizedName(normalize(representative.getPartnerName()));
        rt.setAverageAmount(avgAmount);
        rt.setFrequency(frequency);
        rt.setIsIncome(avgAmount.compareTo(BigDecimal.ZERO) > 0);
        rt.setPaymentType(PaymentType.RECURRING);
        rt.setIsActive(true);
        rt.setUser(currentUser);
        refreshLifecycleDates(rt, allMatched);
        rt = recurringPaymentRepository.save(rt);

        // Persist the rules
        for (Rule rule : transientRules) {
            Rule persistedRule = new Rule();
            persistedRule.setRecurringPayment(rt);
            persistedRule.setRuleType(rule.getRuleType());
            persistedRule.setTargetField(rule.getTargetField());
            persistedRule.setText(rule.getText());
            persistedRule.setStrict(rule.getStrict());
            persistedRule.setThreshold(rule.getThreshold());
            persistedRule.setAmount(rule.getAmount());
            persistedRule.setFluctuationRange(rule.getFluctuationRange());
            persistedRule.setUser(currentUser);
            ruleRepository.save(persistedRule);
        }

        // Create links
        for (Transaction tx : allMatched) {
            createLink(tx, rt);
        }

        // Populate period history and compute rolling average
        historyService.recomputeHistory(rt);
        BigDecimal rollingAvg = historyService.getRollingAverage(rt.getId(), 4);
        if (rollingAvg != null) {
            rt.setAverageAmount(rollingAvg);
            rt.setIsIncome(rollingAvg.compareTo(BigDecimal.ZERO) > 0);
            recurringPaymentRepository.save(rt);
        }

        return rt;
    }

    Frequency detectFrequency(List<Transaction> transactions) {
        if (transactions.size() < MIN_OCCURRENCES) {
            log.debug("Too few transactions ({}) for frequency detection", transactions.size());
            return null;
        }

        List<Long> gaps = computeDayGaps(transactions);
        if (gaps.isEmpty()) {
            log.debug("No gaps computed from {} transactions", transactions.size());
            return null;
        }

        long medianGap = median(gaps);
        log.debug("Frequency detection: {} transactions, gaps={}, medianGap={}",
                transactions.size(), gaps, medianGap);

        if (medianGap >= MONTHLY_MIN_DAYS && medianGap <= MONTHLY_MAX_DAYS) {
            return Frequency.MONTHLY;
        } else if (medianGap >= QUARTERLY_MIN_DAYS && medianGap <= QUARTERLY_MAX_DAYS) {
            return Frequency.QUARTERLY;
        } else if (medianGap >= YEARLY_MIN_DAYS && medianGap <= YEARLY_MAX_DAYS) {
            return Frequency.YEARLY;
        }

        log.debug("Median gap {} does not match any frequency range (monthly={}-{}, quarterly={}-{}, yearly={}-{})",
                medianGap, MONTHLY_MIN_DAYS, MONTHLY_MAX_DAYS, QUARTERLY_MIN_DAYS, QUARTERLY_MAX_DAYS,
                YEARLY_MIN_DAYS, YEARLY_MAX_DAYS);
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
}
