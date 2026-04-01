package com.tracker.service;

import com.tracker.model.entity.Category;
import com.tracker.repository.CategoryRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public List<Category> getAllCategories() {
        return categoryRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Category> getById(UUID id) {
        return categoryRepository.findById(id);
    }

    @Transactional
    public Category create(String name, String color) {
        Category category = new Category();
        category.setName(name);
        category.setColor(color);
        return categoryRepository.save(category);
    }

    @Transactional
    public Optional<Category> update(UUID id, String name, String color) {
        return categoryRepository.findById(id).map(category -> {
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
        return categoryRepository.findById(id).map(category -> {
            categoryRepository.delete(category);
            return true;
        }).orElse(false);
    }
}
