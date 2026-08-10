import { supabase } from "../lib/supabase";

export async function getRecentlyViewedRecipes(userId) {
  const { data, error } = await supabase
    .from("recent_views")
    .select(`
      recipe_id,
      viewed_at,
      recipes (
        id,
        title,
        description,
        image_url,
        difficulty,
        cooking_time,
        servings
      )
    `)
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(8);

  if (error) {
    throw error;
  }

  return (data ?? []).map(row => row.recipes);
}

// 레시피 상세 페이지에서 호출 - 이미 본 레시피면 조회 시각만 갱신, 처음이면 새로 추가
export async function recordRecipeView(userId, recipeId) {
  const { error } = await supabase
    .from("recent_views")
    .upsert(
      { user_id: userId, recipe_id: recipeId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,recipe_id" },
    );

  if (error) {
    throw error;
  }
}
