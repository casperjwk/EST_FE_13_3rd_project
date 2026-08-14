import { supabase } from "../lib/supabase";

const RECIPE_IMAGE_BUCKET = "recipe-images";

export async function getFoodCategories() {
  const { data, error } = await supabase.from("food_categories").select("id, name").order("name");

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function convertToJpeg(file) {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d").drawImage(image, 0, 0);
  image.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error("이미지를 JPG로 변환하지 못했습니다."))),
      "image/jpeg",
      0.9,
    );
  });
}

async function uploadRecipeImage(file) {
  if (!file) return { imageUrl: null, imagePath: null };

  const jpegFile = await convertToJpeg(file);
  const randomFileName = crypto.randomUUID().slice(0, 8);
  const imagePath = `recipes/${randomFileName}.jpg`;
  const { error } = await supabase.storage.from(RECIPE_IMAGE_BUCKET).upload(imagePath, jpegFile, {
    cacheControl: "3600",
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(RECIPE_IMAGE_BUCKET).getPublicUrl(imagePath);
  return { imageUrl: data.publicUrl, imagePath };
}

async function findOrCreateIngredient({ name, category_id: categoryId }) {
  if (!categoryId) {
    throw new Error("재료 카테고리는 필수입니다.");
  }
  let query = supabase.from("ingredients").select("id").eq("name", name).limit(1);
  query = categoryId ? query.eq("category_id", categoryId) : query.is("category_id", null);

  const { data: existingIngredients, error: findError } = await query;
  if (findError) throw findError;
  if (existingIngredients?.[0]) return existingIngredients[0].id;

  const { data, error } = await supabase
    .from("ingredients")
    .insert({ name, category_id: categoryId })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function createRecipe(recipe, imageFile = null) {
  const { imageUrl, imagePath } = await uploadRecipeImage(imageFile);
  const { ingredients = [], cooking_steps: cookingSteps = {}, ...recipeFields } = recipe;
  const recipeToInsert = { ...recipeFields, image_url: imageUrl };
  const { data: createdRecipe, error: recipeError } = await supabase
    .from("recipes")
    .insert(recipeToInsert)
    .select()
    .single();

  if (recipeError) {
    if (imagePath) {
      await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([imagePath]);
    }
    throw recipeError;
  }

  try {
    const ingredientIdCache = new Map();
    const recipeIngredients = [];

    for (const [index, ingredient] of ingredients.entries()) {
      const cacheKey = `${ingredient.name}::${ingredient.category_id ?? ""}`;
      let ingredientId = ingredientIdCache.get(cacheKey);

      if (!ingredientId) {
        ingredientId = await findOrCreateIngredient(ingredient);
        ingredientIdCache.set(cacheKey, ingredientId);
      }

      recipeIngredients.push({
        recipe_id: createdRecipe.id,
        ingredient_id: ingredientId,
        amount: ingredient.amount,
        sort_order: index + 1,
      });
    }

    if (recipeIngredients.length > 0) {
      const { error } = await supabase.from("recipe_ingredients").insert(recipeIngredients);
      if (error) throw error;
    }

    const recipeSteps = [
      ...(cookingSteps.detail ?? []).map(step => ({
        recipe_id: createdRecipe.id,
        step_number: step.step,
        description: step.description,
        step_type: "detail",
      })),
      ...(cookingSteps.simple ?? []).map(step => ({
        recipe_id: createdRecipe.id,
        step_number: step.step,
        description: step.description,
        step_type: "brief",
      })),
    ];

    if (recipeSteps.length > 0) {
      const { error } = await supabase.from("recipe_steps").insert(recipeSteps);
      if (error) throw error;
    }

    return createdRecipe;
  } catch (error) {
    await supabase.from("recipes").delete().eq("id", createdRecipe.id);
    if (imagePath) {
      await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([imagePath]);
    }
    throw error;
  }
}

export async function getPopularRecipes(limit = 4) {
  const { data, error } = await supabase
    .from("recipes")
    .select(`
      id, title, description, image_url, servings, cooking_time, difficulty,
      recipe_ingredients ( ingredients ( category_id ) )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[HankkiLab] getPopularRecipes error:", error);
    return [];
  }
  return data;
}

export async function getRecipesByIds(recipeIds) {
  if (!recipeIds || recipeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("recipes")
    .select(`
      id, title, description, image_url, difficulty, cooking_time, servings,
      recipe_ingredients ( amount, ingredients ( id, name, category_id ) )
    `)
    .in("id", recipeIds);

  if (error) {
    console.error("[HankkiLab] getRecipesByIds error:", error);
    return [];
  }
  return data;
}

export async function getRecipesByVeganType(veganTypeId, limit = 3) {
  // "전체" (필터 없음)
  if (!veganTypeId) {
    const { data, error } = await supabase
      .from("recipes")
      .select(`
        id, title, description, image_url, difficulty, cooking_time, servings,
        recipe_ingredients ( ingredients ( category_id ) )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[HankkiLab] getRecipesByVeganType error:", error);
      return [];
    }
    return data;
  }

  const { data: restrictions, error: restrictionError } = await supabase
    .from("vegan_type_restrictions")
    .select("*")
    .eq("vegan_type_id", veganTypeId);
  if (restrictionError) {
    console.error("[HankkiLab] vegan_type_restrictions error:", restrictionError);
    return [];
  }
  const restrictedCategoryIds = (restrictions ?? []).map(r =>
    String(r.category_id ?? r.food_category_id),
  );

  const { data: recipes, error } = await supabase.from("recipes").select(`
    id, title, description, image_url, difficulty, cooking_time, servings,
    recipe_ingredients ( ingredients ( category_id ) )
  `);
  if (error) {
    console.error("[HankkiLab] getRecipesByVeganType error:", error);
    return [];
  }

  const compatible = (recipes ?? []).filter(recipe => {
    const categoryIds = (recipe.recipe_ingredients ?? []).map(ri =>
      String(ri.ingredients.category_id),
    );
    return !categoryIds.some(id => restrictedCategoryIds.includes(id));
  });

  return compatible.slice(0, limit);
}