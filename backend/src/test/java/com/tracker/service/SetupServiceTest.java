package com.tracker.service;

import com.tracker.controller.SetupAlreadyCompleteException;
import com.tracker.model.entity.SetupState;
import com.tracker.model.entity.User;
import com.tracker.repository.SetupStateRepository;
import com.tracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class SetupServiceTest {

    @Autowired
    private SetupService setupService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SetupStateRepository setupStateRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("delete from payment_period_history");
        jdbcTemplate.update("delete from transaction_recurring_link");
        jdbcTemplate.update("delete from rules");
        jdbcTemplate.update("delete from recurring_payments");
        jdbcTemplate.update("delete from transactions");
        jdbcTemplate.update("delete from file_uploads");
        jdbcTemplate.update("delete from bank_accounts");
        jdbcTemplate.update("delete from categories");
        jdbcTemplate.update("delete from users");
        setupStateRepository.deleteAll();
        setupStateRepository.save(new SetupState());
    }

    @Test
    void createFirstAdminAllowsOnlyOneConcurrentWinner() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try {
            List<Callable<Object>> tasks = List.of(
                    createSetupAttempt("admin-one", ready, start),
                    createSetupAttempt("admin-two", ready, start)
            );

            List<Future<Object>> futures = new ArrayList<>();
            for (Callable<Object> task : tasks) {
                futures.add(executor.submit(task));
            }

            ready.await();
            start.countDown();

            int successCount = 0;
            int alreadyCompleteCount = 0;

            for (Future<Object> future : futures) {
                Object result = future.get();
                if (result instanceof User) {
                    successCount++;
                } else if (result instanceof SetupAlreadyCompleteException) {
                    alreadyCompleteCount++;
                }
            }

            assertThat(successCount).isEqualTo(1);
            assertThat(alreadyCompleteCount).isEqualTo(1);
            assertThat(userRepository.count()).isEqualTo(1);
            assertThat(setupStateRepository.findById(SetupState.SINGLETON_ID))
                    .get()
                    .extracting(SetupState::isCompleted)
                    .isEqualTo(true);
        } finally {
            executor.shutdownNow();
        }
    }

    private Callable<Object> createSetupAttempt(String username, CountDownLatch ready, CountDownLatch start) {
        return () -> {
            ready.countDown();
            start.await();
            try {
                return setupService.createFirstAdmin(username, "securepass");
            } catch (SetupAlreadyCompleteException e) {
                return e;
            }
        };
    }
}
