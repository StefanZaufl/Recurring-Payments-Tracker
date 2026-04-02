package com.tracker.controller;

import com.tracker.api.CategoriesApi;
import com.tracker.api.model.CategoryDto;
import com.tracker.api.model.CreateCategoryRequest;
import com.tracker.api.model.UpdateCategoryRequest;
import com.tracker.service.CategoryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class CategoryController implements CategoriesApi {

    private final CategoryService categoryService;
    private final CategoryMapper categoryMapper;

    public CategoryController(CategoryService categoryService, CategoryMapper categoryMapper) {
        this.categoryService = categoryService;
        this.categoryMapper = categoryMapper;
    }

    @Override
    public ResponseEntity<List<CategoryDto>> getCategories() {
        return ResponseEntity.ok(categoryMapper.toDtoList(categoryService.getAllCategories()));
    }

    @Override
    public ResponseEntity<CategoryDto> getCategoryById(UUID id) {
        return categoryService.getById(id)
                .map(categoryMapper::toDto)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));
    }

    @Override
    public ResponseEntity<CategoryDto> createCategory(CreateCategoryRequest request) {
        var category = categoryService.create(request.getName(), request.getColor());
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryMapper.toDto(category));
    }

    @Override
    public ResponseEntity<CategoryDto> updateCategory(UUID id, UpdateCategoryRequest request) {
        return categoryService.update(id, request.getName(), request.getColor())
                .map(categoryMapper::toDto)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));
    }

    @Override
    public ResponseEntity<Void> deleteCategory(UUID id) {
        if (categoryService.delete(id)) {
            return ResponseEntity.noContent().build();
        }
        throw new ResourceNotFoundException("Category not found: " + id);
    }
}
