package com.tracker.service;

import com.tracker.model.entity.PaymentType;
import com.tracker.model.entity.RecurringPayment;
import com.tracker.model.entity.Rule;
import com.tracker.model.entity.Transaction;
import com.tracker.model.entity.TransactionRecurringLink;
import com.tracker.repository.PaymentPeriodHistoryRepository;
import com.tracker.repository.RecurringPaymentRepository;
import com.tracker.repository.TransactionRecurringLinkRepository;
import com.tracker.repository.TransactionRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class RecurringPaymentRecalculationService {

    private final InterAccountService interAccountService;
    private final TransactionRepository transactionRepository;
    private final TransactionRecurringLinkRepository linkRepository;
    private final RecurringPaymentRepository recurringPaymentRepository;
    private final PaymentPeriodHistoryRepository paymentPeriodHistoryRepository;
    private final RuleEvaluationService ruleEvaluationService;
    private final RecurringPaymentDetectionService detectionService;
    private final UserContextService userContextService;
    private final EntityManager entityManager;
    private final AdditionalMatchingService additionalMatchingService;

    public RecurringPaymentRecalculationService(InterAccountService interAccountService,
                                               TransactionRepository transactionRepository,
                                               TransactionRecurringLinkRepository linkRepository,
                                               RecurringPaymentRepository recurringPaymentRepository,
                                               PaymentPeriodHistoryRepository paymentPeriodHistoryRepository,
                                               RuleEvaluationService ruleEvaluationService,
                                               RecurringPaymentDetectionService detectionService,
                                               UserContextService userContextService,
                                               EntityManager entityManager,
                                               AdditionalMatchingService additionalMatchingService) {
        this.interAccountService = interAccountService;
        this.transactionRepository = transactionRepository;
        this.linkRepository = linkRepository;
        this.recurringPaymentRepository = recurringPaymentRepository;
        this.paymentPeriodHistoryRepository = paymentPeriodHistoryRepository;
        this.ruleEvaluationService = ruleEvaluationService;
        this.detectionService = detectionService;
        this.userContextService = userContextService;
        this.entityManager = entityManager;
        this.additionalMatchingService = additionalMatchingService;
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
            List<Rule> rules = payment.getRules() == null ? List.of() : payment.getRules();
            List<Transaction> matchedTransactions = rules.isEmpty()
                    ? List.of()
                    : ruleEvaluationService.findMatchingTransactions(rules, remainingCandidates);

            if (matchedTransactions.isEmpty()) {
                linkRepository.deleteByRecurringPaymentId(payment.getId());
                paymentPeriodHistoryRepository.deleteByRecurringPaymentId(payment.getId());
                recurringPaymentRepository.delete(payment);
                recurringPaymentsDeleted += 1;
                continue;
            }

            detectionService.rebuildRecurringPayment(payment, matchedTransactions);
            remainingCandidates.removeAll(matchedTransactions);
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

    public record RecalculationResult(int transactionsMarkedInterAccount,
                                      int transactionLinksRemoved,
                                      int recurringPaymentsDeleted,
                                      int recurringPaymentsDetected) {
    }

    private record LinkKey(UUID transactionId, UUID recurringPaymentId) {
    }
}
