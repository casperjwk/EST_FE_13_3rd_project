import { supabase } from "../lib/supabase";

// 유저의 알레르기/비건 조건 + 판단 기준 데이터 가져오기
export async function getUserSafetyConditions(userId) {
  const [
    allergensResult,
    veganTypesResult,
    mappingsResult,
    restrictionsResult,
    profileResult,
    userAllergyResult,
  ] = await Promise.all([
    supabase.from("allergens").select("id, name").order("name"),
    supabase.from("vegan_types").select("id, name").order("name"),
    supabase.from("allergen_category_mappings").select("*"),
    supabase.from("vegan_type_restrictions").select("*"),
    supabase.from("profiles").select("vegan_type_id").eq("id", userId).maybeSingle(),
    supabase.from("user_allergies").select("allergen_id").eq("user_id", userId),
  ]);

  const error =
    allergensResult.error ??
    veganTypesResult.error ??
    mappingsResult.error ??
    restrictionsResult.error ??
    profileResult.error ??
    userAllergyResult.error;

  if (error) {
    console.error("[HankkiLab] getUserSafetyConditions error:", error);
    return null;
  }

  const veganTypeId = profileResult.data?.vegan_type_id ?? null;
  const veganTypeName = veganTypesResult.data?.find(v => v.id === veganTypeId)?.name ?? "";

  return {
    allergenIds: (userAllergyResult.data ?? []).map(row => row.allergen_id),
    allergyOptions: allergensResult.data ?? [],
    allergenCategoryMappings: mappingsResult.data ?? [],
    veganTypeId,
    veganTypeName,
    veganTypeRestrictions: restrictionsResult.data ?? [],
  };
}

function findMatchedAllergy(ingredient, allergenIds, categoryMappings, allergyOptions) {
  const matched = categoryMappings.find(
    mapping =>
      allergenIds.some(id => String(id) === String(mapping.allergen_id)) &&
      String(mapping.category_id ?? mapping.food_category_id) === String(ingredient.categoryId),
  );
  if (!matched) return undefined;
  return allergyOptions.find(a => String(a.id) === String(matched.allergen_id))?.name;
}

function isRestrictedForVeganType(ingredient, veganTypeId, veganTypeRestrictions) {
  if (veganTypeId == null || veganTypeId === "") return false;
  return veganTypeRestrictions.some(
    r =>
      String(r.vegan_type_id) === String(veganTypeId) &&
      String(r.category_id ?? r.food_category_id) === String(ingredient.categoryId),
  );
}

// recipe(재료 포함) + 유저 조건 -> 뱃지 정보로 변환
export function getRecipeSafetyStatus(recipe, conditions) {
  if (!conditions) {
    return { safetyType: "safe", safetyTitle: "안전", safetyDesc: "제한 재료 없음" };
  }

  const {
    allergenIds,
    allergyOptions,
    allergenCategoryMappings,
    veganTypeId,
    veganTypeRestrictions,
  } = conditions;

  const ingredients = (recipe.recipe_ingredients ?? []).map(item => ({
    name: item.ingredients.name,
    categoryId: item.ingredients.category_id,
  }));

  let matchedAllergyName;
  let hasVeganConflict = false;

  for (const ingredient of ingredients) {
    const allergyName = findMatchedAllergy(
      ingredient,
      allergenIds,
      allergenCategoryMappings,
      allergyOptions,
    );
    if (allergyName) {
      matchedAllergyName = allergyName;
      break;
    }
    if (!hasVeganConflict && isRestrictedForVeganType(ingredient, veganTypeId, veganTypeRestrictions)) {
      hasVeganConflict = true;
    }
  }

  if (matchedAllergyName) {
    return { safetyType: "danger", safetyTitle: "AI 주의 감지", safetyDesc: "알레르기 재료 포함" };
  }

  if (hasVeganConflict) {
    return { safetyType: "needReplacement", safetyTitle: "AI 대체 가능", safetyDesc: "대체 재료 추천 있음" };
  }

  return { safetyType: "safe", safetyTitle: "안전", safetyDesc: "제한 재료 없음" };
}