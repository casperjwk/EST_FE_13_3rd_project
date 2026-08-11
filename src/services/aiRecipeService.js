import { supabase } from "../lib/supabase";

async function requestCustomRecipe(recipeId, cacheOnly) {
  const { data, error } = await supabase.functions.invoke("generate-custom-recipe", {
    body: { recipeId, cacheOnly },
  });

  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      const details = await error.context.clone().json().catch(() => null);
      message = details?.message || details?.error || message;
    }
    throw new Error(message || "AI 맞춤 레시피 요청에 실패했습니다.");
  }

  if (data?.error) {
    throw new Error(data.message || data.error);
  }

  return data;
}

export function generateCustomRecipe(recipeId) {
  return requestCustomRecipe(recipeId, false);
}

export function getCachedCustomRecipe(recipeId) {
  return requestCustomRecipe(recipeId, true);
}
