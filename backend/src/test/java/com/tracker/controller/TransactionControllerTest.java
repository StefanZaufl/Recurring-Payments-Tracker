package com.tracker.controller;

import com.tracker.model.entity.FileUpload;
import com.tracker.model.entity.Transaction;
import com.tracker.repository.FileUploadRepository;
import com.tracker.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TransactionControllerTest {

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
        String csv = "Buchungsdatum;Partnername;Betrag;Buchungs-Details\n" +
                "15.01.2025;Netflix;-12,99;Monatliches Abo\n" +
                "01.02.2025;Arbeitgeber GmbH;3.500,00;Gehalt\n";

        MockMultipartFile file = new MockMultipartFile(
                "file", "export.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/transactions/csv").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uploadId").isNotEmpty())
                .andExpect(jsonPath("$.transactionCount").value(2))
                .andExpect(jsonPath("$.recurringPaymentsDetected").value(0));
    }

    @Test
    void uploadCsv_missingRequiredColumn_returns400() throws Exception {
        String csv = "Datum;Name;Wert\n01.01.2025;Test;-10,00\n";

        MockMultipartFile file = new MockMultipartFile(
                "file", "bad.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/transactions/csv").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Buchungsdatum")));
    }

    @Test
    void uploadCsv_invalidDate_returns400() throws Exception {
        String csv = "Buchungsdatum;Partnername;Betrag;Buchungs-Details\n" +
                "2025-01-15;Netflix;-12,99;Abo\n";

        MockMultipartFile file = new MockMultipartFile(
                "file", "bad.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/transactions/csv").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("date")));
    }

    @Test
    void getTransactions_returnsPagedResults() throws Exception {
        seedTransaction("Netflix", LocalDate.of(2025, 1, 15), new BigDecimal("-12.99"));
        seedTransaction("Spotify", LocalDate.of(2025, 2, 1), new BigDecimal("-9.99"));

        mockMvc.perform(get("/api/transactions").param("page", "0").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    void getTransactions_filterByDateRange() throws Exception {
        seedTransaction("Jan", LocalDate.of(2025, 1, 15), new BigDecimal("-10.00"));
        seedTransaction("Mar", LocalDate.of(2025, 3, 15), new BigDecimal("-20.00"));

        mockMvc.perform(get("/api/transactions")
                        .param("from", "2025-02-01")
                        .param("to", "2025-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].partnerName").value("Mar"));
    }

    @Test
    void getTransactions_filterByText() throws Exception {
        seedTransaction("Netflix", LocalDate.of(2025, 1, 15), new BigDecimal("-12.99"));
        seedTransaction("Spotify", LocalDate.of(2025, 1, 15), new BigDecimal("-9.99"));

        mockMvc.perform(get("/api/transactions").param("text", "net"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].partnerName").value("Netflix"));
    }

    @Test
    void getTransactionById_exists_returnsTransaction() throws Exception {
        Transaction tx = seedTransaction("Netflix", LocalDate.of(2025, 1, 15), new BigDecimal("-12.99"));

        mockMvc.perform(get("/api/transactions/{id}", tx.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tx.getId().toString()))
                .andExpect(jsonPath("$.partnerName").value("Netflix"))
                .andExpect(jsonPath("$.amount").value(-12.99));
    }

    @Test
    void getTransactionById_notFound_returns404() throws Exception {
        mockMvc.perform(get("/api/transactions/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    private Transaction seedTransaction(String partnerName, LocalDate date, BigDecimal amount) {
        FileUpload upload = new FileUpload();
        upload.setFilename("test.csv");
        upload.setRowCount(1);
        upload = fileUploadRepository.save(upload);

        Transaction tx = new Transaction();
        tx.setUpload(upload);
        tx.setBookingDate(date);
        tx.setPartnerName(partnerName);
        tx.setAmount(amount);
        return transactionRepository.save(tx);
    }
}
