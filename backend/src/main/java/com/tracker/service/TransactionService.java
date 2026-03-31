package com.tracker.service;

import com.tracker.api.model.TransactionDto;
import com.tracker.api.model.TransactionPage;
import com.tracker.api.model.UploadResponse;
import com.tracker.model.entity.FileUpload;
import com.tracker.model.entity.Transaction;
import com.tracker.repository.FileUploadRepository;
import com.tracker.repository.TransactionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TransactionService {

    private final CsvParserService csvParserService;
    private final TransactionRepository transactionRepository;
    private final FileUploadRepository fileUploadRepository;

    public TransactionService(CsvParserService csvParserService,
                              TransactionRepository transactionRepository,
                              FileUploadRepository fileUploadRepository) {
        this.csvParserService = csvParserService;
        this.transactionRepository = transactionRepository;
        this.fileUploadRepository = fileUploadRepository;
    }

    @Transactional
    public UploadResponse uploadCsv(MultipartFile file) throws IOException {
        List<Transaction> transactions = csvParserService.parse(file);

        FileUpload upload = new FileUpload();
        upload.setFilename(file.getOriginalFilename());
        upload.setMimeType(file.getContentType());
        upload.setRowCount(transactions.size());
        upload = fileUploadRepository.save(upload);

        for (Transaction tx : transactions) {
            tx.setUpload(upload);
        }
        transactionRepository.saveAll(transactions);

        return new UploadResponse(upload.getId(), transactions.size(), 0);
    }

    @Transactional(readOnly = true)
    public TransactionPage getTransactions(LocalDate from, LocalDate to, String text, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "bookingDate"));
        Page<Transaction> result = transactionRepository.findFiltered(from, to, text, pageRequest);

        List<TransactionDto> content = result.getContent().stream()
                .map(this::toDto)
                .toList();

        return new TransactionPage(content, result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public Optional<TransactionDto> getTransactionById(UUID id) {
        return transactionRepository.findById(id).map(this::toDto);
    }

    private TransactionDto toDto(Transaction tx) {
        TransactionDto dto = new TransactionDto();
        dto.setId(tx.getId());
        dto.setUploadId(tx.getUpload() != null ? tx.getUpload().getId() : null);
        dto.setBookingDate(tx.getBookingDate());
        dto.setPartnerName(tx.getPartnerName());
        dto.setPartnerIban(tx.getPartnerIban());
        dto.setAmount(tx.getAmount().doubleValue());
        dto.setCurrency(tx.getCurrency());
        dto.setDetails(tx.getDetails());
        if (tx.getCreatedAt() != null) {
            dto.setCreatedAt(tx.getCreatedAt().atOffset(ZoneOffset.UTC));
        }
        return dto;
    }
}
