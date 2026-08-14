function toId(value) {
  return value == null ? "" : String(value);
}

function getMappingCategoryId(mapping) {
  return mapping.category_id ?? mapping.food_category_id;
}

function filterRecipesByExcludedCategoryIds(recipes, excludeCategoryIds) {
  const excludeSet = new Set(excludeCategoryIds.map(toId).filter(Boolean));

  if (excludeSet.size === 0) {
    return recipes;
  }

  return recipes.filter(
    recipe => !recipe.categoryIds?.some(categoryId => excludeSet.has(toId(categoryId))),
  );
}

export function getAllergenIdsByFilterState(allergyFilters, targetStates) {
  const stateSet = new Set(targetStates);

  return Object.entries(allergyFilters ?? {})
    .filter(([, state]) => stateSet.has(state))
    .map(([allergenId]) => toId(allergenId))
    .filter(Boolean);
}

export function getCategoryIdsByAllergenIds(allergenIds, allergenCategoryMappings) {
  const allergenIdSet = new Set((allergenIds ?? []).map(toId).filter(Boolean));

  if (allergenIdSet.size === 0) {
    return [];
  }

  return [
    ...new Set(
      (allergenCategoryMappings ?? [])
        .filter(mapping => allergenIdSet.has(toId(mapping.allergen_id)))
        .map(getMappingCategoryId)
        .map(toId)
        .filter(Boolean),
    ),
  ];
}

export function filterRecipesByAllergies(
  recipes,
  allergyFilters,
  allergenCategoryMappings = [],
) {
  const excludeAllergenIds = getAllergenIdsByFilterState(allergyFilters, ["exclude"]);
  const excludeCategoryIds = getCategoryIdsByAllergenIds(
    excludeAllergenIds,
    allergenCategoryMappings,
  );

  return filterRecipesByExcludedCategoryIds(recipes, excludeCategoryIds);
}

export function filterRecipesByVeganType(
  recipes,
  veganTypeId,
  veganTypeRestrictions = [],
) {
  if (veganTypeId == null || veganTypeId === "") {
    return recipes;
  }

  const excludeCategoryIds = (veganTypeRestrictions ?? [])
    .filter(restriction => toId(restriction.vegan_type_id) === toId(veganTypeId))
    .map(getMappingCategoryId)
    .filter(Boolean);

  return filterRecipesByExcludedCategoryIds(recipes, excludeCategoryIds);
}
