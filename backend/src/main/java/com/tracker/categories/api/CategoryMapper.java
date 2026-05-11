package com.tracker.categories.api;

import com.tracker.api.model.CategoryDto;
import com.tracker.categories.domain.Category;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface CategoryMapper {

    CategoryDto toDto(Category entity);

    List<CategoryDto> toDtoList(List<Category> entities);
}
