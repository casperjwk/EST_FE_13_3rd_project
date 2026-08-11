import { supabase } from "../lib/supabase";

export async function getFavoriteRecipes(userId) {
  const { data, error } = await supabase
    .from("favorites")
    .select(`
      recipe_id,
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
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map(row => row.recipes);
}

export async function getFavoriteRecipeIds(userId) {
  const { data, error } = await supabase.from("favorites").select("recipe_id").eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map(row => row.recipe_id);
}

export async function addFavorite(userId, recipeId) {
  const { error } = await supabase.from("favorites").insert({ user_id: userId, recipe_id: recipeId });

  if (error) {
    throw error;
  }
}

export async function removeFavorite(userId, recipeId) {
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("recipe_id", recipeId);

  if (error) {
    throw error;
  }
}

// 레시피별 실제 좋아요(즐겨찾기) 개수 - RLS 우회하는 DB 함수(get_favorite_counts) 호출
export async function getFavoriteCounts(recipeIds) {
  if (!recipeIds || recipeIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase.rpc("get_favorite_counts", { recipe_ids: recipeIds });

  if (error) {
    throw error;
  }

  const counts = {};
  for (const row of data ?? []) {
    counts[row.recipe_id] = row.favorite_count;
  }
  return counts;
}
