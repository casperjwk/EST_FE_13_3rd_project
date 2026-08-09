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
