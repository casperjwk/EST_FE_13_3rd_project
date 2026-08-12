const VEGAN_EXCLUDE_CATEGORY_IDS = {
  일반: [],
  플렉시테리언: [],
  폴로: ["pork", "beef", "meat", "fish", "shrimp", "crab", "shellfish", "seafood"],
  페스코: ["pork", "chicken", "beef", "meat"],
  "락토-오보": [
    "pork",
    "chicken",
    "beef",
    "meat",
    "fish",
    "shrimp",
    "crab",
    "shellfish",
    "seafood",
  ],
  락토: [
    "pork",
    "chicken",
    "beef",
    "meat",
    "fish",
    "shrimp",
    "crab",
    "shellfish",
    "seafood",
    "eggs",
  ],
  오보: [
    "pork",
    "chicken",
    "beef",
    "meat",
    "fish",
    "shrimp",
    "crab",
    "shellfish",
    "seafood",
    "dairy",
  ],
  비건: [
    "pork",
    "chicken",
    "beef",
    "meat",
    "fish",
    "shrimp",
    "crab",
    "shellfish",
    "seafood",
    "dairy",
    "eggs",
    "honey",
  ],
};

export function filterRecipesByVeganType(recipes, veganType) {
  const excludeIds = VEGAN_EXCLUDE_CATEGORY_IDS[veganType] ?? [];

  if (excludeIds.length === 0) {
    return recipes;
  }

  return recipes.filter(
    (recipe) => !recipe.categoryIds?.some((categoryId) => excludeIds.includes(categoryId)),
  );
}

const ALLERGY_CATEGORY_IDS = {
  우유: "dairy",
  생선: "fish",
  달걀: "eggs",
  복숭아: "peach",
  밀: "wheat",
  토마토: "tomato",
  대두: "soy",
  땅콩: "peanut",
  돼지고기: "pork",
  견과류: "nuts",
  닭고기: "chicken",
  새우: "shrimp",
  소고기: "beef",
  게: "crab",
  조개류: "shellfish",
};

export function filterRecipesByAllergies(recipes, allergyFilters) {
  const excludeCategoryIds = Object.entries(allergyFilters)
    .filter(([, state]) => state === "exclude")
    .map(([name]) => ALLERGY_CATEGORY_IDS[name])
    .filter(Boolean);

  if (excludeCategoryIds.length === 0) {
    return recipes;
  }

  return recipes.filter(
    (recipe) => !recipe.categoryIds?.some((categoryId) => excludeCategoryIds.includes(categoryId)),
  );
}
