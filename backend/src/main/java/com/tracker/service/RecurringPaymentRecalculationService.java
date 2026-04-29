package com.tracker.service;

import com.tracker.controller.ResourceNotFoundException;
import com.tracker.model.entity.PaymentType;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.repository.PaymentPeriodHistoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.RuleRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class RecurringPaymentRecalculationService {

    private final InterAccountService interAccountService;
    private final TransactionRepository transactionRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final PaymentPeriodHistoryRepository paymentPeriodHistoryRepository;
    private final PaymentPeriodHistoryService paymentPeriodHistoryService;
    private final RuleEvaluationService ruleEvaluationService;
    private final RecurringPaymentDetectionService detectionService;
    private final UserContextService userContextService;
    private final EntityManager entityManager;
    private final AdditionalMatchingService additionalMatchingService;
    private final RuleRepository ruleRepository;

    public RecurringPaymentRecalculationService(InterAccountService interAccountService,
                                               TransactionRepository transactionRepository,
                                               TransactionRecurringLinkRepository linkRepository,
                                               RecurringPaymentRepository recurringPaymentRepository,
                                               PaymentPeriodHistoryRepository paymentPeriodHistoryRepository,
                                               PaymentPeriodHistoryService paymentPeriodHistoryService,
                                               RuleEvaluationService ruleEvaluationService,
                                               RecurringPaymentDetectionService detectionService,
                                               UserContextService userContextService,
                                               EntityManager entityManager,
                                               AdditionalMatchingService additionalMatchingService,
                                               RuleRepository ruleRepository) {
        this.interAccountService = interAccountService;
        this.transactionRepository = transactionRepository;
        this.linkRepository = linkRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.paymentPeriodHistoryRepository = paymentPeriodHistoryRepository;
        this.paymentPeriodHistoryService = paymentPeriodHistoryService;
        this.ruleEvaluationService = ruleEvaluationService;
        this.detectionService = detectionService;
        this.userContextService = userContextService;
        this.entityManager = entityManager;
        this.additionalMatchingService = additionalMatchingService;
        this.ruleRepository = ruleRepository;
    }

    @Transactional
    public RecalculationResult recalculateCurrentUserRecurringPayments() {
        UUID currentUserId = userContextService.getCurrentUserId();
        int transactionsMarkedInterAccount = interAccountService.remarkCurrentUserTransactions();

        Set<LinkKey> previousLinks = toLinkKeys(linkRepository.findByUserId(currentUserId));
        entityManager.clear();
        List<RecurringPayment> existingPayments = new ArrayList<>(recurringPaymentRepository.findByUserId(currentUserId));
        Set<UUID> existingPaymentIds = existingPayments.stream()
                .map(RecurringPayment::getId)
                .collect(java.util.stream.Collectors.toSet());

        LocalDate cutoff = LocalDate.now().minusDays(RecurringPaymentDetectionService.LOOKBACK_DAYS);
        List<Transaction> remainingCandidates = new ArrayList<>(
                transactionRepository.findByUserIdAndBookingDateGreaterThanEqualAndIsInterAccountFalse(currentUserId, cutoff));
        remainingCandidates = new ArrayList<>(additionalMatchingService.filterExcluded(remainingCandidates));

        int recurringPaymentsDeleted = 0;
        for (RecurringPayment payment : sortPayments(existingPayments)) {
            if (payment.getEndDate() == null) {
                List<Rule> rules = payment.getRules() == null ? List.of() : payment.getRules();
                List<Transaction> matchedTransactions = rules.isEmpty()
                        ? List.of()
                        : ruleEvaluationService.findMatchingTransactions(rules, remainingCandidates);

                if (matchedTransactions.isEmpty()) {
                    linkRepository.deleteByRecurringPaymentId(payment.getId());
                    paymentPeriodHistoryRepository.deleteByRecurringPaymentId(payment.getId());
                    recurringPaymentRepository.delete(payment);
                    recurringPaymentsDeleted += 1;
                } else {
                    detectionService.rebuildRecurringPayment(payment, matchedTransactions);
                    remainingCandidates.removeAll(matchedTransactions);
                }
            }
        }

        List<RecurringPayment> recalculatedPayments = detectionService.detectRecurringPayments(remainingCandidates);
        int recurringPaymentsDetected = (int) recalculatedPayments.stream()
                .map(RecurringPayment::getId)
                .filter(id -> !existingPaymentIds.contains(id))
                .count();

        Set<LinkKey> finalLinks = toLinkKeys(linkRepository.findByUserId(currentUserId));
        int transactionLinksRemoved = (int) previousLinks.stream()
                .filter(link -> !finalLinks.contains(link))
                .count();

        return new RecalculationResult(
                transactionsMarkedInterAccount,
                transactionLinksRemoved,
                recurringPaymentsDeleted,
                recurringPaymentsDetected
        );
    }

    @Transactional
    public void recalculateRecurringPaymentLinks(UUID recurringPaymentId) {
        UUID currentUserId = userContextService.getCurrentUserId();
        RecurringPayment payment = recurringPaymentRepository.findByIdAndUserId(recurringPaymentId, currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Recurring payment not found: " + recurringPaymentId));
        List<Rule> rules = ruleRepository.findByRecurringPaymentIdAndUserId(recurringPaymentId, currentUserId);
        List<TransactionRecurringLink> existingLinks = linkRepository
                .findWithTransactionByRecurringPaymentIdAndUserId(recurringPaymentId, currentUserId);
        List<Transaction> existingTransactions = existingLinks.stream()
                .map(TransactionRecurringLink::getTransaction)
                .toList();

        LocalDate cutoff = LocalDate.now().minusDays(RecurringPaymentDetectionService.LOOKBACK_DAYS);
        List<Transaction> unlinkedTransactions = additionalMatchingService.filterExcluded(
                transactionRepository.findUnlinkedTransactionsAfterForUser(cutoff, currentUserId));

        List<Transaction> candidates = new ArrayList<>(existingTransactions);
        candidates.addAll(unlinkedTransactions);
        List<Transaction> matchedTransactions = rules.isEmpty()
                ? List.of()
                : ruleEvaluationService.findMatchingTransactions(rules, candidates);
        Set<UUID> matchedIds = matchedTransactions.stream()
                .map(Transaction::getId)
                .collect(Collectors.toSet());

        existingLinks.stream()
                .filter(link -> !matchedIds.contains(link.getTransaction().getId()))
                .forEach(linkRepository::delete);

        Map<UUID, Transaction> existingById = existingTransactions.stream()
                .collect(Collectors.toMap(Transaction::getId, Function.identity()));
        unlinkedTransactions.stream()
                .filter(tx -> matchedIds.contains(tx.getId()))
                .filter(tx -> !existingById.containsKey(tx.getId()))
                .forEach(tx -> createLink(tx, payment));
        linkRepository.flush();

        if (matchedTransactions.isEmpty()) {
            payment.setAverageAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            payment.setIsActive(false);
            paymentPeriodHistoryService.recomputeHistory(payment);
            recurringPaymentRepository.save(payment);
            return;
        }

        recomputePaymentFacts(payment, matchedTransactions);
        detectionService.refreshLifecycleDates(payment, matchedTransactions);
        paymentPeriodHistoryService.recomputeHistory(payment);
        BigDecimal rollingAverage = paymentPeriodHistoryService.getRollingAverage(payment.getId(), 4);
        if (rollingAverage != null) {
            payment.setAverageAmount(rollingAverage);
            payment.setIsIncome(rollingAverage.compareTo(BigDecimal.ZERO) > 0);
        }
        recurringPaymentRepository.save(payment);
    }

    private List<RecurringPayment> sortPayments(List<RecurringPayment> payments) {
        return payments.stream()
                .sorted(Comparator
                        .comparing((RecurringPayment payment) -> !Boolean.TRUE.equals(payment.getIsActive()))
                        .thenComparing(payment -> payment.getPaymentType() == PaymentType.GROUPED)
                        .thenComparing(RecurringPayment::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(RecurringPayment::getId))
                .toList();
    }

    private Set<LinkKey> toLinkKeys(List<TransactionRecurringLink> links) {
        Set<LinkKey> result = new HashSet<>();
        for (TransactionRecurringLink link : links) {
            result.add(new LinkKey(link.getTransaction().getId(), link.getRecurringPayment().getId()));
        }
        return result;
    }

    private void createLink(Transaction transaction, RecurringPayment payment) {
        TransactionRecurringLink link = new TransactionRecurringLink();
        link.setTransaction(transaction);
        link.setRecurringPayment(payment);
        link.setConfidenceScore(BigDecimal.ONE.setScale(2, RoundingMode.HALF_UP));
        link.setUser(userContextService.getCurrentUser());
        linkRepository.save(link);
    }

    private void recomputePaymentFacts(RecurringPayment payment, List<Transaction> matchedTransactions) {
        BigDecimal sum = matchedTransactions.stream()
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal average = sum.divide(BigDecimal.valueOf(matchedTransactions.size()), 2, RoundingMode.HALF_UP);
        payment.setAverageAmount(average);
        payment.setIsIncome(average.compareTo(BigDecimal.ZERO) > 0);

        var frequency = detectionService.detectFrequency(matchedTransactions);
        if (frequency != null) {
            payment.setFrequency(frequency);
        }
    }

    public record RecalculationResult(int transactionsMarkedInterAccount,
                                      int transactionLinksRemoved,
                                      int recurringPaymentsDeleted,
                                      int recurringPaymentsDetected) {
    }

    private record LinkKey(UUID transactionId, UUID recurringPaymentId) {
    }
}
