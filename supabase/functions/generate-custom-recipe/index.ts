import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type GenerateRequest = { recipeId?: string; cacheOnly?: boolean };
type NamedRelation = { id: string; name: string };
type OriginalIngredient = {
  id: string;
  name: string;
  amount: string | null;
  categoryId: string | null;
  sortOrder: number;
};
type OriginalStep = {
  stepNumber: number;
  description: string;
  stepType: "detail" | "brief";
};
type Restriction = {
  ingredient: OriginalIngredient;
  allergyNames: string[];
  veganRestricted: boolean;
  reason: string;
};
type AiIngredient = {
  original_id: string;
  name: string;
  amount: string;
  category_id: string;
};
type AiStep = { step_number: number; description: string };
type AiRecipe = {
  title: string;
  description: string;
  servings: number | null;
  cooking_time: number | null;
  ingredients: AiIngredient[];
  detail_steps: AiStep[];
  brief_steps: AiStep[];
};

const ALAN_API_DEFAULT = "https://kdt-api-function.azurewebsites.net/api/v1";
const PROMPT_LIMIT = 6500;
const ALAN_ENCODED_CONTENT_LIMIT = 5600;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map(String))].sort();
}

function sameIds(left: string[], right: string[]) {
  const a = uniqueSorted(left);
  const b = uniqueSorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function compact(value: unknown, limit: number) {
  const text = typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function buildReason(
  allergies: string[],
  veganType: string,
  veganRestricted: boolean,
) {
  const reasons = allergies.map((name) => `${name} 알레르기`);
  if (veganRestricted) reasons.push(`${veganType} 대체`);
  return reasons.join(" + ");
}

function extractAlanAnswer(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.answer === "string") return record.answer;
  if (typeof record.content === "string") return record.content;
  return null;
}

function parseAiRecipe(text: string): AiRecipe {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Alan response does not contain JSON");
  }

  const value = JSON.parse(cleaned.slice(start, end + 1)) as Partial<AiRecipe>;
  if (
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    !Array.isArray(value.ingredients) ||
    !Array.isArray(value.detail_steps) ||
    !Array.isArray(value.brief_steps)
  ) {
    throw new Error("Alan response has an invalid recipe shape");
  }
  return value as AiRecipe;
}

function validateAiRecipe(
  ai: AiRecipe,
  restricted: Restriction[],
  originalSteps: OriginalStep[],
  forbiddenCategoryIds: Set<string>,
) {
  const restrictedIds = new Set(restricted.map((item) => item.ingredient.id));
  const returnedIds = ai.ingredients.map((item) => item?.original_id);
  if (!sameIds(returnedIds, [...restrictedIds])) {
    throw new Error(
      "Alan must return exactly one replacement for every restricted ingredient",
    );
  }

  for (const item of ai.ingredients) {
    if (
      !item ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      typeof item.amount !== "string" ||
      !item.amount.trim() ||
      typeof item.category_id !== "string" ||
      !item.category_id
    ) {
      throw new Error("Alan returned an invalid replacement ingredient");
    }
    if (forbiddenCategoryIds.has(String(item.category_id))) {
      throw new Error("Alan returned a replacement from a forbidden category");
    }
  }

  for (const stepType of ["detail", "brief"] as const) {
    const expected = originalSteps.filter((step) => step.stepType === stepType);
    const received = stepType === "detail" ? ai.detail_steps : ai.brief_steps;
    if (
      received.length !== expected.length ||
      received.some(
        (step, index) =>
          !step ||
          step.step_number !== expected[index].stepNumber ||
          typeof step.description !== "string" ||
          !step.description.trim(),
      )
    ) {
      throw new Error(
        `Alan must preserve every ${stepType} step number and count`,
      );
    }
  }
}

function createPrompt(args: {
  recipe: Record<string, unknown>;
  ingredients: OriginalIngredient[];
  steps: OriginalStep[];
  restrictions: Restriction[];
  allergies: NamedRelation[];
  veganType: NamedRelation | null;
  categories: NamedRelation[];
}) {
  const restrictedIds = new Set(
    args.restrictions.map((item) => item.ingredient.id),
  );
  const detailLimits = [110, 75, 45, 24];

  for (const detailLimit of detailLimits) {
    const input = {
      u: {
        allergy: args.allergies.map((item) => item.name),
        vegan: args.veganType?.name ?? "none",
      },
      r: {
        title: compact(args.recipe.title, 60),
        servings: args.recipe.servings,
        time: args.recipe.cooking_time,
        safe: args.ingredients
          .filter((item) => !restrictedIds.has(item.id))
          .map((item) => compact(item.name, 18)),
        replace: args.restrictions.map((item) => ({
          id: item.ingredient.id,
          name: compact(item.ingredient.name, 24),
          amount: compact(item.ingredient.amount, 16),
          reason: item.reason,
        })),
        detail: args.steps
          .filter((item) => item.stepType === "detail")
          .map((item) => ({
            n: item.stepNumber,
            text: compact(item.description, detailLimit),
          })),
        brief_numbers: args.steps
          .filter((item) => item.stepType === "brief")
          .map((item) => item.stepNumber),
      },
      categories: args.categories.map((item) =>
        detailLimit === 24 ? item.id : `${item.id}:${item.name}`
      ),
    };

    const prompt =
      `Adapt this recipe. Output valid JSON only; write user-facing text in Korean. Replace every item in r.replace, avoid u.allergy and obey u.vegan. Choose category_id from categories. Output only replacements. Rewrite the detail steps using replacements. Keep the same detail step numbers. Create concise brief steps using exactly r.brief_numbers.
JSON={"title":"","description":"","servings":null,"cooking_time":null,"ingredients":[{"original_id":"","name":"","amount":"","category_id":""}],"detail_steps":[{"step_number":1,"description":""}],"brief_steps":[{"step_number":1,"description":""}]}
DATA=${JSON.stringify(input)}`;

    if (
      prompt.length <= PROMPT_LIMIT &&
      encodeURIComponent(prompt).length <= ALAN_ENCODED_CONTENT_LIMIT
    ) {
      return prompt;
    }
  }

  throw new Error("Alan prompt is too long after URL encoding");
}

async function callAlan(prompt: string) {
  const base = Deno.env.get("ALAN_API_BASE_URL") ?? ALAN_API_DEFAULT;
  const clientId = Deno.env.get("ALAN_CLIENT_ID");
  if (!clientId) throw new Error("ALAN_CLIENT_ID is not configured");

  const url = new URL(`${base.replace(/\/$/, "")}/question`);
  url.searchParams.set("content", prompt);
  url.searchParams.set("client_id", clientId);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Alan request failed", { status: response.status });
    throw new Error(`Alan API returned ${response.status}`);
  }
  const answer = extractAlanAnswer(data);
  if (!answer) throw new Error("Alan response has no answer or content");
  return parseAiRecipe(answer);
}

function normalizeCustomRecipe(
  row: Record<string, any>,
  source: "cache" | "generated",
) {
  const substitutions = new Map<string, Record<string, any>>(
    (row.ai_custom_recipe_substitutions ?? []).map((
      item: Record<string, any>,
    ) => [
      String(item.substitute_ingredient_id),
      item,
    ]),
  );
  return {
    source,
    customRecipe: {
      id: row.id,
      originalRecipeId: row.original_recipe_id,
      title: row.title,
      description: row.description,
      servings: row.servings,
      cookingTime: row.cooking_time,
      veganTypeId: row.vegan_type_id,
      allergenIds: (row.ai_custom_recipe_allergies ?? []).map(
        (item: Record<string, string>) => item.allergen_id,
      ),
      ingredients: (row.ai_custom_recipe_ingredients ?? [])
        .slice()
        .sort((a: Record<string, number>, b: Record<string, number>) =>
          a.sort_order - b.sort_order
        )
        .map((item: Record<string, any>) => {
          const ingredient = one(item.ingredients);
          const substitution = substitutions.get(String(item.ingredient_id));
          return {
            ingredientId: item.ingredient_id,
            name: ingredient?.name,
            categoryId: ingredient?.category_id,
            amount: item.amount,
            sortOrder: item.sort_order,
            replacement: substitution
              ? {
                originalIngredientId: substitution.original_ingredient_id,
                reason: substitution.reason,
              }
              : null,
          };
        }),
      steps: {
        detail: (row.ai_custom_recipe_steps ?? [])
          .filter((step: Record<string, string>) => step.step_type === "detail")
          .sort(
            (a: Record<string, number>, b: Record<string, number>) =>
              a.step_number - b.step_number,
          ),
        brief: (row.ai_custom_recipe_steps ?? [])
          .filter((step: Record<string, string>) => step.step_type === "brief")
          .sort(
            (a: Record<string, number>, b: Record<string, number>) =>
              a.step_number - b.step_number,
          ),
      },
    },
  };
}

const customRecipeSelect = `
  id, original_recipe_id, user_id, vegan_type_id, title, description, servings, cooking_time,
  ai_custom_recipe_allergies (allergen_id),
  ai_custom_recipe_ingredients (amount, sort_order, ingredient_id, ingredients (id, name, category_id)),
  ai_custom_recipe_steps (step_number, description, step_type),
  ai_custom_recipe_substitutions (original_ingredient_id, substitute_ingredient_id, reason)
`;

async function findCachedRecipe(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  veganTypeId: string | null,
  allergenIds: string[],
) {
  let query = supabase
    .from("ai_custom_recipes")
    .select(customRecipeSelect)
    .eq("user_id", userId)
    .eq("original_recipe_id", recipeId)
    .order("created_at", { ascending: false });
  query = veganTypeId
    ? query.eq("vegan_type_id", veganTypeId)
    : query.is("vegan_type_id", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).find((row) =>
    sameIds(
      (row.ai_custom_recipe_allergies ?? []).map((item) => item.allergen_id),
      allergenIds,
    )
  );
}

async function findOrCreateIngredient(
  supabase: SupabaseClient,
  item: AiIngredient,
) {
  const { data: found, error: findError } = await supabase
    .from("ingredients")
    .select("id")
    .eq("name", item.name.trim())
    .eq("category_id", item.category_id)
    .limit(1);
  if (findError) throw findError;
  if (found?.[0]) return found[0].id as string;

  const { data, error } = await supabase
    .from("ingredients")
    .insert({ name: item.name.trim(), category_id: item.category_id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !key) {
    return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);
  }
  if (!authorization) return json({ error: "UNAUTHORIZED" }, 401);

  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!body.recipeId || typeof body.recipeId !== "string") {
    return json({ error: "RECIPE_ID_REQUIRED" }, 400);
  }

  const supabase = createClient(supabaseUrl, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return json({ error: "UNAUTHORIZED" }, 401);
  const userId = authData.user.id;

  try {
    const [profileResult, allergyResult, recipeResult, categoriesResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("vegan_type_id, vegan_types(id, name)")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("user_allergies")
          .select("allergen_id, allergens(id, name)")
          .eq("user_id", userId),
        supabase
          .from("recipes")
          .select(
            `id, title, description, servings, cooking_time,
          recipe_ingredients (amount, sort_order, ingredients (id, name, category_id)),
          recipe_steps (step_number, description, step_type)`,
          )
          .eq("id", body.recipeId)
          .maybeSingle(),
        supabase.from("food_categories").select("id, name").order("name"),
      ]);
    const loadError = profileResult.error ?? allergyResult.error ??
      recipeResult.error ?? categoriesResult.error;
    if (loadError) throw loadError;
    if (!recipeResult.data) return json({ error: "RECIPE_NOT_FOUND" }, 404);

    const veganTypeId = profileResult.data?.vegan_type_id ?? null;
    const veganType = one(profileResult.data?.vegan_types) as
      | NamedRelation
      | null;
    const allergies = (allergyResult.data ?? [])
      .map((item) => one(item.allergens) as NamedRelation | null)
      .filter((item): item is NamedRelation => Boolean(item));
    const allergenIds = uniqueSorted(
      (allergyResult.data ?? []).map((item) => item.allergen_id),
    );

    const cached = await findCachedRecipe(
      supabase,
      userId,
      body.recipeId,
      veganTypeId,
      allergenIds,
    );
    if (cached) return json(normalizeCustomRecipe(cached, "cache"));
    if (body.cacheOnly) return json({ status: "cache_miss" });

    const [mappingResult, veganRestrictionResult] = await Promise.all([
      allergenIds.length
        ? supabase
          .from("allergen_category_mappings")
          .select("allergen_id, category_id")
          .in("allergen_id", allergenIds)
        : Promise.resolve({ data: [], error: null }),
      veganTypeId
        ? supabase
          .from("vegan_type_restrictions")
          .select("category_id")
          .eq("vegan_type_id", veganTypeId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (mappingResult.error || veganRestrictionResult.error) {
      throw mappingResult.error ?? veganRestrictionResult.error;
    }

    const allergenNameById = new Map(
      allergies.map((item) => [item.id, item.name]),
    );
    const allergyIdsByCategory = new Map<string, string[]>();
    for (const mapping of mappingResult.data ?? []) {
      const ids = allergyIdsByCategory.get(String(mapping.category_id)) ?? [];
      ids.push(String(mapping.allergen_id));
      allergyIdsByCategory.set(String(mapping.category_id), ids);
    }
    const veganCategoryIds = new Set(
      (veganRestrictionResult.data ?? []).map((item) =>
        String(item.category_id)
      ),
    );
    const forbiddenCategoryIds = new Set([
      ...allergyIdsByCategory.keys(),
      ...veganCategoryIds,
    ]);

    const recipe = recipeResult.data as Record<string, any>;
    const ingredients: OriginalIngredient[] = (recipe.recipe_ingredients ?? [])
      .map((row: Record<string, any>) => {
        const ingredient = one(row.ingredients);
        return ingredient
          ? {
            id: String(ingredient.id),
            name: String(ingredient.name),
            amount: row.amount == null ? null : String(row.amount),
            categoryId: ingredient.category_id == null
              ? null
              : String(ingredient.category_id),
            sortOrder: Number(row.sort_order),
          }
          : null;
      })
      .filter((item: OriginalIngredient | null): item is OriginalIngredient =>
        Boolean(item)
      )
      .sort((a: OriginalIngredient, b: OriginalIngredient) =>
        a.sortOrder - b.sortOrder
      );
    const steps: OriginalStep[] = (recipe.recipe_steps ?? [])
      .filter(
        (step: Record<string, any>) =>
          step.step_type === "detail" || step.step_type === "brief",
      )
      .map((step: Record<string, any>) => ({
        stepNumber: Number(step.step_number),
        description: String(step.description),
        stepType: step.step_type,
      }))
      .sort((a: OriginalStep, b: OriginalStep) => a.stepNumber - b.stepNumber);

    const restrictions: Restriction[] = ingredients.flatMap((ingredient) => {
      if (!ingredient.categoryId) return [];
      const allergyNames =
        (allergyIdsByCategory.get(ingredient.categoryId) ?? [])
          .map((id) => allergenNameById.get(id))
          .filter((name): name is string => Boolean(name));
      const veganRestricted = veganCategoryIds.has(ingredient.categoryId);
      if (!allergyNames.length && !veganRestricted) return [];
      return [
        {
          ingredient,
          allergyNames,
          veganRestricted,
          reason: buildReason(
            allergyNames,
            veganType?.name ?? "비건",
            veganRestricted,
          ),
        },
      ];
    });

    if (!restrictions.length) {
      return json({
        status: "replacement_not_required",
        source: "rules",
        recipeId: body.recipeId,
      });
    }

    const prompt = createPrompt({
      recipe,
      ingredients,
      steps,
      restrictions,
      allergies,
      veganType,
      categories: ((categoriesResult.data ?? []) as NamedRelation[]).filter(
        (category) => !forbiddenCategoryIds.has(String(category.id)),
      ),
    });
    const ai = await callAlan(prompt);
    validateAiRecipe(ai, restrictions, steps, forbiddenCategoryIds);

    const aiByOriginalId = new Map(
      ai.ingredients.map((item) => [item.original_id, item]),
    );
    const restrictionByOriginalId = new Map(
      restrictions.map((item) => [item.ingredient.id, item]),
    );
    const replacementIds = new Map<string, string>();
    for (const item of ai.ingredients) {
      replacementIds.set(
        item.original_id,
        await findOrCreateIngredient(supabase, item),
      );
    }

    const { data: parent, error: parentError } = await supabase
      .from("ai_custom_recipes")
      .insert({
        original_recipe_id: body.recipeId,
        user_id: userId,
        vegan_type_id: veganTypeId,
        title: ai.title.trim(),
        description: ai.description.trim() || null,
        servings: Number.isFinite(ai.servings) ? ai.servings : recipe.servings,
        cooking_time: Number.isFinite(ai.cooking_time)
          ? ai.cooking_time
          : recipe.cooking_time,
      })
      .select("id")
      .single();
    if (parentError) throw parentError;
    const customId = parent.id as string;

    try {
      const ingredientRows = ingredients.map((ingredient) => {
        const replacement = aiByOriginalId.get(ingredient.id);
        return {
          ai_custom_recipe_id: customId,
          ingredient_id: replacementIds.get(ingredient.id) ?? ingredient.id,
          amount: replacement?.amount.trim() || ingredient.amount || "적당량",
          sort_order: ingredient.sortOrder,
        };
      });
      const stepRows = [
        ...ai.detail_steps.map((step) => ({ ...step, step_type: "detail" })),
        ...ai.brief_steps.map((step) => ({ ...step, step_type: "brief" })),
      ].map((step) => ({
        ai_custom_recipe_id: customId,
        step_number: step.step_number,
        description: step.description.trim(),
        step_type: step.step_type,
      }));
      const substitutionRows = restrictions.map((item) => ({
        ai_custom_recipe_id: customId,
        original_ingredient_id: item.ingredient.id,
        substitute_ingredient_id: replacementIds.get(item.ingredient.id)!,
        reason: restrictionByOriginalId.get(item.ingredient.id)!.reason,
      }));
      const allergyRows = allergenIds.map((allergenId) => ({
        ai_custom_recipe_id: customId,
        allergen_id: allergenId,
      }));

      const results = await Promise.all([
        supabase.from("ai_custom_recipe_ingredients").insert(ingredientRows),
        supabase.from("ai_custom_recipe_steps").insert(stepRows),
        supabase.from("ai_custom_recipe_substitutions").insert(
          substitutionRows,
        ),
        allergyRows.length
          ? supabase.from("ai_custom_recipe_allergies").insert(allergyRows)
          : Promise.resolve({ error: null }),
      ]);
      const childError = results.find((result) => result.error)?.error;
      if (childError) throw childError;
    } catch (error) {
      await supabase.from("ai_custom_recipes").delete().eq("id", customId);
      throw error;
    }

    const { data: saved, error: savedError } = await supabase
      .from("ai_custom_recipes")
      .select(customRecipeSelect)
      .eq("id", customId)
      .single();
    if (savedError) throw savedError;
    return json(normalizeCustomRecipe(saved, "generated"), 201);
  } catch (error) {
    console.error("Custom recipe generation failed", error);
    return json(
      {
        error: "CUSTOM_RECIPE_GENERATION_FAILED",
        message: error instanceof Error
          ? error.message
          : "Unknown generation error",
      },
      500,
    );
  }
});
