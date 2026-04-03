package com.tracker.service;

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
    static final int LOOKBACK_DAYS = 400;

    private final TransactionRepository transactionRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final RuleRepository ruleRepository;
    private final RuleEvaluationService ruleEvaluationService;

    public RecurringPaymentDetectionService(TransactionRepository transactionRepository,
                                            RecurringPaymentRepository recurringPaymentRepository,
                                            TransactionRecurringLinkRepository linkRepository,
                                            RuleRepository ruleRepository,
                                            RuleEvaluationService ruleEvaluationService) {
        this.transactionRepository = transactionRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.linkRepository = linkRepository;
        this.ruleRepository = ruleRepository;
        this.ruleEvaluationService = ruleEvaluationService;
    }

    /**
     * Incremental detection: matches new transactions against existing RTs,
     * then tries to form new RTs from unmatched transactions.
     */
    @Transactional
    public List<RecurringPayment> detectRecurringPayments(List<Transaction> newTransactions) {
        if (newTransactions.isEmpty()) {
            return List.of();
        }

        List<RecurringPayment> result = new ArrayList<>();
        List<Transaction> unmatched = new ArrayList<>(newTransactions);

        // Step 1: Match against existing active RTs
        List<RecurringPayment> existingRts = recurringPaymentRepository.findByIsActiveTrue();
        for (RecurringPayment rt : existingRts) {
            List<Rule> rules = rt.getRules();
            if (rules.isEmpty()) {
                continue;
            }

            List<Transaction> matched = ruleEvaluationService.findMatchingTransactions(rules, unmatched);
            if (!matched.isEmpty()) {
                for (Transaction tx : matched) {
                    createLink(tx, rt);
                }
                // Sliding window: update AmountRule to newest transaction's amount
                updateAmountRuleToNewest(rules, matched);
                // Recompute average amount
                recomputeAverageAmount(rt);
                recurringPaymentRepository.save(rt);
                unmatched.removeAll(matched);
                result.add(rt);
            }
        }

        // Step 2: Try to form new RTs from unmatched transactions
        LocalDate cutoff = LocalDate.now().minusDays(LOOKBACK_DAYS);
        List<Transaction> oldUnlinked = transactionRepository.findUnlinkedTransactionsAfter(cutoff);

        // Iterate over a copy since we modify unmatched during iteration
        List<Transaction> toProcess = new ArrayList<>(unmatched);
        for (Transaction tx : toProcess) {
            if (!unmatched.contains(tx)) {
                continue; // already matched by a previously created transient RT
            }
            if (tx.getPartnerName() == null || tx.getPartnerName().isBlank()) {
                continue;
            }

            List<Rule> transientRules = createTransientRules(tx);

            // Candidates: old unlinked + remaining unmatched new (excluding self)
            List<Transaction> candidates = new ArrayList<>(oldUnlinked);
            for (Transaction u : unmatched) {
                if (!u.getId().equals(tx.getId())) {
                    candidates.add(u);
                }
            }

            List<Transaction> additionalMatches = ruleEvaluationService.findMatchingTransactions(transientRules, candidates);

            if (!additionalMatches.isEmpty()) {
                List<Transaction> allMatched = new ArrayList<>();
                allMatched.add(tx);
                allMatched.addAll(additionalMatches);

                String frequency = detectFrequency(allMatched);
                if (frequency != null) {
                    RecurringPayment rt = createAndPersistRecurringPayment(tx, allMatched, transientRules, frequency);
                    result.add(rt);
                    unmatched.removeAll(allMatched);
                    oldUnlinked.removeAll(additionalMatches);
                }
            }
        }

        log.info("Detection complete: {} RTs updated/created from {} new transactions ({} unmatched)",
                result.size(), newTransactions.size(), unmatched.size());
        return result;
    }

    /**
     * Re-evaluates an existing RT against unlinked transactions.
     * Only adds new transactions, never removes existing ones.
     */
    @Transactional
    public RecurringPayment reEvaluateRecurringPayment(UUID recurringPaymentId) {
        RecurringPayment rt = recurringPaymentRepository.findById(recurringPaymentId)
                .orElseThrow(() -> new NoSuchElementException("Recurring payment not found: " + recurringPaymentId));

        List<Rule> rules = ruleRepository.findByRecurringPaymentId(recurringPaymentId);
        if (rules.isEmpty()) {
            return rt;
        }

        Set<UUID> alreadyLinkedIds = linkRepository.findByRecurringPaymentId(recurringPaymentId)
                .stream().map(link -> link.getTransaction().getId()).collect(Collectors.toSet());

        LocalDate cutoff = LocalDate.now().minusDays(LOOKBACK_DAYS);
        List<Transaction> candidates = transactionRepository.findUnlinkedTransactionsAfter(cutoff);

        List<Transaction> newMatches = ruleEvaluationService.findMatchingTransactions(rules, candidates)
                .stream().filter(tx -> !alreadyLinkedIds.contains(tx.getId())).toList();

        for (Transaction tx : newMatches) {
            createLink(tx, rt);
        }

        if (!newMatches.isEmpty()) {
            recomputeAverageAmount(rt);
            // Recompute frequency with all linked transactions
            List<Transaction> allTxs = getAllLinkedTransactions(recurringPaymentId);
            allTxs.addAll(newMatches);
            String freq = detectFrequency(allTxs);
            if (freq != null) {
                rt.setFrequency(freq);
            }
            recurringPaymentRepository.save(rt);
        }

        return rt;
    }

    private List<Transaction> getAllLinkedTransactions(UUID recurringPaymentId) {
        return linkRepository.findByRecurringPaymentId(recurringPaymentId)
                .stream().map(TransactionRecurringLink::getTransaction)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private void createLink(Transaction tx, RecurringPayment rt) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(tx);
        link.setRecurringPayment(rt);
        link.setConfidenceScore(BigDecimal.ONE.setScale(2, RoundingMode.HALF_UP));
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
        List<TransactionRecurringLink> links = linkRepository.findByRecurringPaymentId(rt.getId());
        if (links.isEmpty()) return;

        BigDecimal sum = links.stream()
                .map(link -> link.getTransaction().getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        rt.setAverageAmount(sum.divide(BigDecimal.valueOf(links.size()), 2, RoundingMode.HALF_UP));
        rt.setIsIncome(rt.getAverageAmount().compareTo(BigDecimal.ZERO) > 0);
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

        return List.of(jwRule, amountRule);
    }

    private RecurringPayment createAndPersistRecurringPayment(Transaction representative,
                                                               List<Transaction> allMatched,
                                                               List<Rule> transientRules,
                                                               String frequency) {
        BigDecimal avgAmount = allMatched.stream()
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(allMatched.size()), 2, RoundingMode.HALF_UP);

        RecurringPayment rt = new RecurringPayment();
        rt.setName(representative.getPartnerName());
        rt.setNormalizedName(normalize(representative.getPartnerName()));
        rt.setAverageAmount(avgAmount);
        rt.setFrequency(frequency);
        rt.setIsIncome(avgAmount.compareTo(BigDecimal.ZERO) > 0);
        rt.setIsActive(true);
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
            ruleRepository.save(persistedRule);
        }

        // Create links
        for (Transaction tx : allMatched) {
            createLink(tx, rt);
        }

        return rt;
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
}
