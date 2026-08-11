import { supabase } from "../lib/supabase";
import { getFavoriteCounts } from "./favoriteService";

const DIFFICULTY_ORDER = {
  easy: 1,
  normal: 2,
  hard: 3,
};

function sortRecipes(recipes, sortType) {
  const sortedRecipes = [...recipes];

  if (sortType === "likes") {
    return sortedRecipes.sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  if (sortType === "difficulty") {
    return sortedRecipes.sort((a, b) => {
      const aDifficulty = DIFFICULTY_ORDER[a.difficulty] ?? 99;
      const bDifficulty = DIFFICULTY_ORDER[b.difficulty] ?? 99;

      if (aDifficulty !== bDifficulty) return aDifficulty - bDifficulty;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  return sortedRecipes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getRecips(sortType = "created") {
  const { data, error } = await supabase
    .from("recipes")
    .select(`
      id,
      image_url,
      title,
      description,
      servings,
      cooking_time,
      difficulty,
      created_at,
      recipe_ingredients (
        ingredients (
          category_id
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const favoriteCounts = await getFavoriteCounts((data ?? []).map(recipe => recipe.id));

  const recipes = (data ?? []).map(recipe => ({
    id: recipe.id,
    image_url: recipe.image_url,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    cooking_time: recipe.cooking_time,
    difficulty: recipe.difficulty,
    created_at: recipe.created_at,
    likes: favoriteCounts[recipe.id] ?? 0,
    categoryIds: recipe.recipe_ingredients
      ?.map(item => item.ingredients?.category_id)
      .filter(Boolean) ?? [],
  }));

  return sortRecipes(recipes, sortType);
}
