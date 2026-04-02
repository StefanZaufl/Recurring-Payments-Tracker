package com.tracker.controller;

import com.tracker.model.entity.FileUpload;
import com.tracker.model.entity.Transaction;
import com.tracker.repository.FileUploadRepository;
import com.tracker.repository.TransactionRepository;
import com.tracker.testutil.CsvMother;
import com.tracker.testutil.FileUploadMother;
import com.tracker.testutil.TransactionMother;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static com.tracker.controller.TransactionController.*;
import static com.tracker.testutil.CsvMother.*;
import static com.tracker.testutil.TransactionMother.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TransactionControllerTest {

    private static final String TRANSACTIONS_URL = "/api/transactions";
    private static final String UPLOAD_URL = "/api/transactions/csv";
    private static final String PAGE_PARAM = "page";
    private static final String SIZE_PARAM = "size";
    private static final String FROM_PARAM = "from";
    private static final String TO_PARAM = "to";
    private static final String TEXT_PARAM = "text";
    private static final String SORT_PARAM = "sort";
    private static final String SORT_DIR_PARAM = "sortDirection";

    private static final int PAGE_SIZE_2 = 2;
    private static final int TOTAL_PAGING_ITEMS = 3;
    private static final int EXPECTED_PAGES = 2;

    private static final String PARTNER_JAN = "Jan Payment";
    private static final String PARTNER_MAR = "Mar Payment";
    private static final LocalDate JAN_DATE = LocalDate.of(2025, 1, 15);
    private static final LocalDate FEB_DATE = LocalDate.of(2025, 2, 1);
    private static final LocalDate MAR_DATE = LocalDate.of(2025, 3, 15);
    private static final BigDecimal TEN = new BigDecimal("-10.00");
    private static final BigDecimal TWENTY = new BigDecimal("-20.00");
    private static final BigDecimal THIRTY = new BigDecimal("-30.00");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private FileUploadRepository fileUploadRepository;

    @BeforeEach
    void setUp() {
        transactionRepository.deleteAll();
        fileUploadRepository.deleteAll();
    }

    @Test
    void uploadCsv_validFile_returnsUploadResponse() throws Exception {
        MockMultipartFile file = CsvMother.validTwoRowFile();

        mockMvc.perform(multipart(UPLOAD_URL).file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uploadId").isNotEmpty())
                .andExpect(jsonPath("$.transactionCount").value(2))
                .andExpect(jsonPath("$.recurringPaymentsDetected").value(0));
    }

    @Test
    void uploadCsv_missingRequiredColumn_returns400() throws Exception {
        MockMultipartFile file = CsvMother.multipartFile(INVALID_HEADER, "01.01.2025;Test;-10,00");

        mockMvc.perform(multipart(UPLOAD_URL).file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Buchungsdatum")));
    }

    @Test
    void uploadCsv_invalidDate_returns400() throws Exception {
        MockMultipartFile file = CsvMother.multipartFile(HEADER, INVALID_DATE_ROW);

        mockMvc.perform(multipart(UPLOAD_URL).file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("date")));
    }

    @Test
    void getTransactions_returnsPagedResults() throws Exception {
        seedTransaction(TransactionMother.netflix());
        seedTransaction(TransactionMother.spotify());

        mockMvc.perform(get(TRANSACTIONS_URL).param(PAGE_PARAM, "0").param(SIZE_PARAM, "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(header().string(HEADER_TOTAL_ITEMS, "2"))
                .andExpect(header().string(HEADER_PAGE, "0"))
                .andExpect(header().string(HEADER_PAGE_SIZE, "10"))
                .andExpect(header().string(HEADER_TOTAL_PAGES, "1"));
    }

    @Test
    void getTransactions_pagingAcrossTwoPages() throws Exception {
        // Seed 3 transactions, request page size 2 -> should yield 2 pages
        Transaction tx1 = seedTransaction(TransactionMother.transaction(NETFLIX, JAN_DATE, TEN));
        Transaction tx2 = seedTransaction(TransactionMother.transaction(SPOTIFY, FEB_DATE, TWENTY));
        Transaction tx3 = seedTransaction(TransactionMother.transaction(EMPLOYER, MAR_DATE, THIRTY));

        // Page 0: most recent first (sorted DESC by bookingDate) -> Mar, Feb
        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(PAGE_PARAM, "0")
                        .param(SIZE_PARAM, String.valueOf(PAGE_SIZE_2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(TOTAL_PAGING_ITEMS))
                .andExpect(jsonPath("$.totalPages").value(EXPECTED_PAGES))
                .andExpect(jsonPath("$.content", hasSize(PAGE_SIZE_2)))
                .andExpect(jsonPath("$.content[0].partnerName").value(EMPLOYER))
                .andExpect(jsonPath("$.content[0].amount").value(-30.00))
                .andExpect(jsonPath("$.content[1].partnerName").value(SPOTIFY))
                .andExpect(jsonPath("$.content[1].amount").value(-20.00))
                .andExpect(header().string(HEADER_TOTAL_ITEMS, String.valueOf(TOTAL_PAGING_ITEMS)))
                .andExpect(header().string(HEADER_PAGE, "0"))
                .andExpect(header().string(HEADER_PAGE_SIZE, String.valueOf(PAGE_SIZE_2)))
                .andExpect(header().string(HEADER_TOTAL_PAGES, String.valueOf(EXPECTED_PAGES)));

        // Page 1: remaining item -> Jan
        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(PAGE_PARAM, "1")
                        .param(SIZE_PARAM, String.valueOf(PAGE_SIZE_2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(TOTAL_PAGING_ITEMS))
                .andExpect(jsonPath("$.totalPages").value(EXPECTED_PAGES))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].partnerName").value(NETFLIX))
                .andExpect(jsonPath("$.content[0].amount").value(-10.00))
                .andExpect(header().string(HEADER_TOTAL_ITEMS, String.valueOf(TOTAL_PAGING_ITEMS)))
                .andExpect(header().string(HEADER_PAGE, "1"))
                .andExpect(header().string(HEADER_PAGE_SIZE, String.valueOf(PAGE_SIZE_2)))
                .andExpect(header().string(HEADER_TOTAL_PAGES, String.valueOf(EXPECTED_PAGES)));
    }

    @Test
    void getTransactions_filterByDateRange() throws Exception {
        seedTransaction(TransactionMother.transaction(PARTNER_JAN, JAN_DATE, TEN));
        seedTransaction(TransactionMother.transaction(PARTNER_MAR, MAR_DATE, TWENTY));

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(FROM_PARAM, "2025-02-01")
                        .param(TO_PARAM, "2025-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].partnerName").value(PARTNER_MAR));
    }

    @Test
    void getTransactions_filterByText() throws Exception {
        seedTransaction(TransactionMother.netflix());
        seedTransaction(TransactionMother.spotify());

        mockMvc.perform(get(TRANSACTIONS_URL).param(TEXT_PARAM, "net"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].partnerName").value(NETFLIX));
    }

    @Test
    void getTransactions_sortByPartnerNameAsc() throws Exception {
        seedTransaction(TransactionMother.transaction(NETFLIX, JAN_DATE, TEN));
        seedTransaction(TransactionMother.transaction(EMPLOYER, FEB_DATE, TWENTY));
        seedTransaction(TransactionMother.transaction(SPOTIFY, MAR_DATE, THIRTY));

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(SORT_PARAM, "partnerName")
                        .param(SORT_DIR_PARAM, "asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].partnerName").value(EMPLOYER))
                .andExpect(jsonPath("$.content[1].partnerName").value(NETFLIX))
                .andExpect(jsonPath("$.content[2].partnerName").value(SPOTIFY));
    }

    @Test
    void getTransactions_sortByAmountDesc() throws Exception {
        seedTransaction(TransactionMother.transaction(NETFLIX, JAN_DATE, TEN));
        seedTransaction(TransactionMother.transaction(SPOTIFY, FEB_DATE, TWENTY));
        seedTransaction(TransactionMother.transaction(EMPLOYER, MAR_DATE, THIRTY));

        mockMvc.perform(get(TRANSACTIONS_URL)
                        .param(SORT_PARAM, "amount")
                        .param(SORT_DIR_PARAM, "desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].amount").value(-10.00))
                .andExpect(jsonPath("$.content[1].amount").value(-20.00))
                .andExpect(jsonPath("$.content[2].amount").value(-30.00));
    }

    @Test
    void getTransactionById_exists_returnsTransaction() throws Exception {
        Transaction tx = seedTransaction(TransactionMother.netflix());

        mockMvc.perform(get(TRANSACTIONS_URL + "/{id}", tx.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tx.getId().toString()))
                .andExpect(jsonPath("$.partnerName").value(NETFLIX))
                .andExpect(jsonPath("$.amount").value(NETFLIX_AMOUNT.doubleValue()));
    }

    @Test
    void getTransactionById_notFound_returns404() throws Exception {
        mockMvc.perform(get(TRANSACTIONS_URL + "/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    private Transaction seedTransaction(Transaction tx) {
        FileUpload upload = fileUploadRepository.save(FileUploadMother.csvUpload());
        tx.setUpload(upload);
        return transactionRepository.save(tx);
    }
}
