package com.tracker.controller;

import com.tracker.api.model.CategoryDto;
import com.tracker.model.entity.Category;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface CategoryMapper {

    CategoryDto toDto(Category entity);

    List<CategoryDto> toDtoList(List<Category> entities);
}
