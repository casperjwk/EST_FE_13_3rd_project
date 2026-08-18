import { supabase } from "../lib/supabase";

async function requestCustomRecipe(recipeId, cacheOnly, conditions) {
  const { data, error } = await supabase.functions.invoke("generate-custom-recipe", {
    body: { recipeId, cacheOnly, conditions },
  });

  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      const details = await error.context
        .clone()
        .json()
        .catch(() => null);
      message = details?.message || details?.error || message;
    }
    throw new Error(message || "AI 맞춤 레시피 요청에 실패했습니다.");
  }

  if (data?.error) {
    throw new Error(data.message || data.error);
  }

  return data;
}

export function generateCustomRecipe(recipeId, conditions) {
  return requestCustomRecipe(recipeId, false, conditions);
}

export function getCachedCustomRecipe(recipeId, conditions) {
  return requestCustomRecipe(recipeId, true, conditions);
}

function sameIds(a, b) {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

export async function getAiReplacedRecipeIds(userId, recipeIds, conditions) {
  if (!userId || recipeIds.length === 0 || !conditions) return new Set();

  const allergenIds = [...(conditions.allergenIds ?? [])].map(String).sort();
  const veganTypeId = conditions.veganTypeId ?? null;

  let query = supabase
    .from("ai_custom_recipes")
    .select(
      `
      original_recipe_id,
      vegan_type_id,
      ai_custom_recipe_allergies (
        allergen_id
      )
    `,
    )
    .eq("user_id", userId)
    .in("original_recipe_id", recipeIds);

  query = veganTypeId ? query.eq("vegan_type_id", veganTypeId) : query.is("vegan_type_id", null);

  const { data, error } = await query;

  if (error) {
    console.error("[HankkiLab] AI custom recipe status error:", error);
    return new Set();
  }

  return new Set(
    (data ?? [])
      .filter((row) => {
        const savedAllergenIds = (row.ai_custom_recipe_allergies ?? [])
          .map((item) => String(item.allergen_id))
          .sort();

        return sameIds(savedAllergenIds, allergenIds);
      })
      .map((row) => String(row.original_recipe_id)),
  );
}
