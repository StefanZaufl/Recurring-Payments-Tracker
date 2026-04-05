package com.tracker.service;

import com.tracker.model.entity.Category;
import com.tracker.model.entity.User;
import com.tracker.repository.CategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final UserContextService userContextService;

    public CategoryService(CategoryRepository categoryRepository, UserContextService userContextService) {
        this.categoryRepository = categoryRepository;
        this.userContextService = userContextService;
    }

    @Transactional(readOnly = true)
    public List<Category> getAllCategories() {
        return categoryRepository.findByUserId(userContextService.getCurrentUserId());
    }

    @Transactional(readOnly = true)
    public Optional<Category> getById(UUID id) {
        return categoryRepository.findByIdAndUserId(id, userContextService.getCurrentUserId());
    }

    @Transactional
    public Category create(String name, String color) {
        User currentUser = userContextService.getCurrentUser();
        Category category = new Category();
        category.setName(name);
        category.setColor(color);
        category.setUser(currentUser);
        return categoryRepository.save(category);
    }

    @Transactional
    public Optional<Category> update(UUID id, String name, String color) {
        return categoryRepository.findByIdAndUserId(id, userContextService.getCurrentUserId()).map(category -> {
            if (name != null) {
                category.setName(name);
            }
            if (color != null) {
                category.setColor(color);
            }
            return categoryRepository.save(category);
        });
    }

    @Transactional
    public boolean delete(UUID id) {
        return categoryRepository.findByIdAndUserId(id, userContextService.getCurrentUserId()).map(category -> {
            categoryRepository.delete(category);
            return true;
        }).orElse(false);
    }
}
