import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type GenerateRequest = {
  recipeId?: string;
  cacheOnly?: boolean;
  conditions?: {
    allergenIds?: string[];
    veganTypeId?: string | null;
  };
};
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

// HTTP 응답 및 오류 처리 유틸리티

// 전달받은 데이터를 CORS 헤더가 포함된 JSON 응답으로 변환
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

// 알 수 없는 오류값을 로그와 응답에 사용할 수 있는 객체로 정리
function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const messageParts = [record.message, record.details, record.hint]
      .filter(value => typeof value === "string" && value.trim())
      .map(String);

    return {
      message: messageParts.join(" | ") || "Unknown generation error",
      code: typeof record.code === "string" ? record.code : undefined,
      details: record.details,
      hint: record.hint,
    };
  }

  return {
    message: typeof error === "string" && error.trim() ? error : "Unknown generation error",
  };
}

// 데이터 정규화 및 비교 유틸리티

// 단일 객체 또는 배열 형태의 관계형 데이터를 하나의 객체로 정규화
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

// 문자열 ID 목록의 중복을 제거하고 비교 가능한 순서로 정렬
function uniqueSorted(values: string[]) {
  return [...new Set(values.map(String))].sort();
}

// 두 ID 목록이 순서와 관계없이 동일한 값으로 구성됐는지 확인
function sameIds(left: string[], right: string[]) {
  const a = uniqueSorted(left);
  const b = uniqueSorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// 알 수 없는 값을 공백이 정리된 제한 길이의 문자열로 변환
function compact(value: unknown, limit: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

// 알레르기와 비건 제한 정보를 대체 사유 문구로 생성
function buildReason(allergies: string[], veganType: string, veganRestricted: boolean) {
  const reasons = allergies.map(name => `${name} 알레르기`);
  if (veganRestricted) reasons.push(`${veganType} 대체`);
  return reasons.join(" + ");
}

// Alan 응답 파싱 및 검증

// Alan 응답 객체에서 실제 답변 문자열 추출
function extractAlanAnswer(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.answer === "string") return record.answer;
  if (typeof record.content === "string") return record.content;
  return null;
}

// Alan이 반환한 텍스트에서 JSON을 추출해 맞춤 레시피 객체 변환
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

// JSON 파싱이나 생성 결과 검증처럼 보정 프롬프트로 다시 요청할 수 있는 오류인지 확인합니다.
function isCorrectableAlanOutputError(error: unknown) {
  if (error instanceof SyntaxError) return true;
  if (!(error instanceof Error)) return false;

  return [
    "Alan response has no answer or content",
    "Alan response does not contain JSON",
    "Alan response has an invalid recipe shape",
    "Alan must return exactly one replacement for every restricted ingredient",
    "Alan returned an invalid replacement ingredient",
    "Alan returned a replacement from a forbidden category",
    "Alan must preserve every",
  ].some(message => error.message.includes(message));
}

// 대체재 개수가 맞으면 요청 순서를 기준으로 원본 재료 ID를 확실하게 다시 연결합니다.
function alignReplacementOriginalIds(ai: AiRecipe, restricted: Restriction[]) {
  if (ai.ingredients.length !== restricted.length) {
    throw new Error("Alan must return exactly one replacement for every restricted ingredient");
  }

  const expectedIds = restricted.map(item => item.ingredient.id);
  const returnedIds = ai.ingredients.map(item => String(item?.original_id ?? ""));

  if (!sameIds(returnedIds, expectedIds)) {
    console.warn("Alan returned mismatched original ingredient IDs; aligning them by request order", {
      expectedOriginalIds: expectedIds,
      returnedOriginalIds: returnedIds,
    });

    ai.ingredients = ai.ingredients.map((item, index) => ({
      ...item,
      original_id: expectedIds[index],
    }));
  }

  return ai;
}

// 생성된 레시피가 대체 재료와 조리 단계 규칙을 모두 지켰는지 검증합니다.
function validateAiRecipe(
  ai: AiRecipe,
  restricted: Restriction[],
  originalSteps: OriginalStep[],
  forbiddenCategoryIds: Set<string>,
) {
  const restrictedIds = new Set(restricted.map(item => item.ingredient.id));
  const returnedIds = ai.ingredients.map(item => item?.original_id);
  if (!sameIds(returnedIds, [...restrictedIds])) {
    throw new Error("Alan must return exactly one replacement for every restricted ingredient");
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
    const expected = originalSteps.filter(step => step.stepType === stepType);
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
      throw new Error(`Alan must preserve every ${stepType} step number and count`);
    }
  }
}

// 맞춤 레시피 프롬프트 생성

// 사용자 조건과 원본 레시피를 바탕으로 길이 제한에 맞는 생성 프롬프트 생성
function createPrompt(args: {
  recipe: Record<string, unknown>;
  ingredients: OriginalIngredient[];
  steps: OriginalStep[];
  restrictions: Restriction[];
  allergies: NamedRelation[];
  veganType: NamedRelation | null;
  categories: NamedRelation[];
}) {
  const restrictedIds = new Set(args.restrictions.map(item => item.ingredient.id));
  const detailLimits = [110, 75, 45, 24];

  for (const detailLimit of detailLimits) {
    const input = {
      u: {
        allergy: args.allergies.map(item => item.name),
        vegan: args.veganType?.name ?? "none",
      },
      r: {
        title: compact(args.recipe.title, 60),
        servings: args.recipe.servings,
        time: args.recipe.cooking_time,
        safe: args.ingredients
          .filter(item => !restrictedIds.has(item.id))
          .map(item => compact(item.name, 18)),
        replace: args.restrictions.map(item => ({
          id: item.ingredient.id,
          name: compact(item.ingredient.name, 24),
          amount: compact(item.ingredient.amount, 16),
          reason: item.reason,
        })),
        detail: args.steps
          .filter(item => item.stepType === "detail")
          .map(item => ({
            n: item.stepNumber,
            text: compact(item.description, detailLimit),
          })),
        brief_numbers: args.steps
          .filter(item => item.stepType === "brief")
          .map(item => item.stepNumber),
      },
      categories: args.categories.map(item =>
        detailLimit === 24 ? item.id : `${item.id}:${item.name}`,
      ),
    };

    const prompt = `Adapt this recipe. Output valid JSON only; write user-facing text in Korean. Replace every item in r.replace, avoid u.allergy and obey u.vegan. Return ingredients in exactly the same order as r.replace, one output item for each input item, and copy each r.replace id unchanged into original_id. Choose category_id from categories and output only replacements. Before rewriting, compare each replacement with the original ingredient's role, moisture, texture, fat, browning, flavor and cooking speed. Where these differ, change preparation, cut size, heat, time, oil or liquid, seasoning and insertion order as needed so the dish cooks correctly; do not merely swap ingredient names. If the same method is genuinely suitable, keep it. Preserve unaffected instructions as closely as possible. Keep the same detail step count, order and numbers. Create brief steps using exactly r.brief_numbers. Each brief step must be one complete practical Korean sentence containing enough ingredient, action, heat and time information to cook from. Do not output fragments or overly short summaries.
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

// 검증 실패 시 누락된 재료와 조리 단계 형식을 바로잡도록 재요청 문구 생성
function createCorrectionPrompt(
  originalPrompt: string,
  restrictions: Restriction[],
  steps: OriginalStep[],
) {
  const expectedIds = restrictions.map(item => item.ingredient.id);
  const detailStepNumbers = steps
    .filter(step => step.stepType === "detail")
    .map(step => step.stepNumber);
  const briefStepNumbers = steps
    .filter(step => step.stepType === "brief")
    .map(step => step.stepNumber);

  return `${originalPrompt}
RETRY_CORRECTION: The previous output failed validation. Return the complete JSON again. ingredients must contain exactly ${expectedIds.length} items, with each expected original_id exactly once and no other original_id. EXPECTED_ORIGINAL_IDS=${JSON.stringify(expectedIds)}. Preserve step numbers exactly: detail=${JSON.stringify(detailStepNumbers)}, brief=${JSON.stringify(briefStepNumbers)}. Use only allowed category_id values from DATA.categories. Output JSON only.`;
}

// Alan API 통신 및 상태 초기화

// 지정한 클라이언트 ID와 프롬프트로 Alan 질문 API 한 번 호출
async function requestAlan(base: string, clientId: string, prompt: string) {
  const url = new URL(`${base.replace(/\/$/, "")}/question`);
  url.searchParams.set("content", prompt);
  url.searchParams.set("client_id", clientId);

  const response = await fetch(url, {
    headers: { Accept: "application/json, text/plain" },
    signal: AbortSignal.timeout(60_000),
  });

  const responseText = await response.text();
  let responseData: unknown = responseText;

  try {
    responseData = JSON.parse(responseText);
  } catch {
    // JSON이 아닌 오류 응답도 진단할 수 있도록 문자열 유지
  }

  return { response, responseData };
}

// 클라이언트 ID에 저장된 Alan의 이전 대화 상태 초기화
async function resetAlanState(base: string, clientId: string) {
  const response = await fetch(`${base.replace(/\/$/, "")}/reset-state`, {
    method: "DELETE",
    headers: {
      Accept: "application/json, text/plain",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: clientId }),
    signal: AbortSignal.timeout(15_000),
  });

  const responseText = await response.text();
  let responseData: unknown = responseText;

  try {
    responseData = JSON.parse(responseText);
  } catch {
    // 본문이 없는 204 응답이나 일반 문자열 응답 허용
  }

  if (!response.ok) {
    console.error("Alan state reset failed", {
      status: response.status,
      statusText: response.statusText,
      responseData,
    });
    return false;
  }

  console.info("Alan state reset completed", { status: response.status });
  return true;
}

// 필요하면 상태를 초기화하고 Alan 호출 실패 시 한 번 재시도한 뒤 결과 파싱
async function callAlan(prompt: string, resetBeforeRequest = false) {
  const base = Deno.env.get("ALAN_API_BASE_URL") ?? ALAN_API_DEFAULT;
  const clientId = Deno.env.get("ALAN_CLIENT_ID");
  if (!clientId) throw new Error("ALAN_CLIENT_ID is not configured");

  if (resetBeforeRequest) {
    await resetAlanState(base, clientId);
  }

  let { response, responseData } = await requestAlan(base, clientId, prompt);

  if (!response.ok) {
    console.error("Alan request failed", {
      status: response.status,
      statusText: response.statusText,
      responseData,
    });

    if (response.status === 500 && (await resetAlanState(base, clientId))) {
      console.info("Retrying Alan request once after state reset");
      ({ response, responseData } = await requestAlan(base, clientId, prompt));
    }
  }

  if (!response.ok) {
    console.error("Alan request ultimately failed", {
      status: response.status,
      statusText: response.statusText,
      responseData,
    });
    throw new Error(`Alan API returned ${response.status}`);
  }

  const answer = extractAlanAnswer(responseData);
  if (!answer) throw new Error("Alan response has no answer or content");

  try {
    return parseAiRecipe(answer);
  } catch (error) {
    console.warn("Alan response parsing failed", {
      error: describeError(error),
      responseData,
    });
    throw error;
  }
}

// 맞춤 레시피 조회 및 저장 데이터 처리

// 데이터베이스의 맞춤 레시피 행을 프론트엔드 응답 형식으로 변환
function normalizeCustomRecipe(row: Record<string, any>, source: "cache" | "generated") {
  const substitutions = new Map<string, Record<string, any>>(
    (row.ai_custom_recipe_substitutions ?? []).map((item: Record<string, any>) => [
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
        .sort((a: Record<string, number>, b: Record<string, number>) => a.sort_order - b.sort_order)
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
            (a: Record<string, number>, b: Record<string, number>) => a.step_number - b.step_number,
          ),
        brief: (row.ai_custom_recipe_steps ?? [])
          .filter((step: Record<string, string>) => step.step_type === "brief")
          .sort(
            (a: Record<string, number>, b: Record<string, number>) => a.step_number - b.step_number,
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

// 동일한 사용자 조건으로 이전에 생성한 맞춤 레시피가 있는지 조회
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
  query = veganTypeId ? query.eq("vegan_type_id", veganTypeId) : query.is("vegan_type_id", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).find(row =>
    sameIds(
      (row.ai_custom_recipe_allergies ?? []).map(item => item.allergen_id),
      allergenIds,
    ),
  );
}

// 대체 재료를 이름으로 조회하고 없으면 새로 생성해 재료 ID 반환
async function findOrCreateIngredient(
  supabase: SupabaseClient,
  item: AiIngredient,
  forbiddenCategoryIds: Set<string>,
) {
  const ingredientName = item.name.trim();

  // 같은 이름의 기존 재료를 조회하고 금지 카테고리 여부 검증
  const getExistingIngredient = async () => {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, category_id")
      .eq("name", ingredientName)
      .maybeSingle();

    if (error) throw error;
    if (data?.category_id != null && forbiddenCategoryIds.has(String(data.category_id))) {
      throw new Error("Alan selected an existing ingredient from a forbidden category");
    }

    return data;
  };

  const found = await getExistingIngredient();
  if (found) return found.id as string;

  const { data, error } = await supabase
    .from("ingredients")
    .insert({ name: ingredientName, category_id: item.category_id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const concurrentlyCreated = await getExistingIngredient();
      if (concurrentlyCreated) return concurrentlyCreated.id as string;
    }
    throw error;
  }

  return data.id as string;
}

// Edge Function 요청 처리

// 사용자 조건 분석부터 AI 생성, 데이터 저장 및 최종 응답까지 전체 흐름 처리
Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
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
  if (
    body.conditions != null &&
    (typeof body.conditions !== "object" ||
      !Array.isArray(body.conditions.allergenIds) ||
      body.conditions.allergenIds.some(id => typeof id !== "string" || !id.trim()) ||
      (body.conditions.veganTypeId != null &&
        (typeof body.conditions.veganTypeId !== "string" || !body.conditions.veganTypeId.trim())))
  ) {
    return json({ error: "INVALID_CONDITIONS" }, 400);
  }

  const supabase = createClient(supabaseUrl, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return json({ error: "UNAUTHORIZED" }, 401);
  const userId = authData.user.id;

  try {
    const [profileResult, allergyResult, recipeResult, categoriesResult] = await Promise.all([
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
    const loadError =
      profileResult.error ?? allergyResult.error ?? recipeResult.error ?? categoriesResult.error;
    if (loadError) throw loadError;
    if (!recipeResult.data) return json({ error: "RECIPE_NOT_FOUND" }, 404);

    let veganTypeId = profileResult.data?.vegan_type_id ?? null;
    let veganType = one(profileResult.data?.vegan_types) as NamedRelation | null;
    let allergies = (allergyResult.data ?? [])
      .map(item => one(item.allergens) as NamedRelation | null)
      .filter((item): item is NamedRelation => Boolean(item));
    let allergenIds = uniqueSorted((allergyResult.data ?? []).map(item => item.allergen_id));

    // 상세 페이지에서 조건을 수정한 경우 프로필 대신 요청 조건을 검증해 사용합니다.
    if (body.conditions) {
      allergenIds = uniqueSorted(body.conditions.allergenIds ?? []);
      veganTypeId = body.conditions.veganTypeId?.trim() || null;

      const [selectedAllergiesResult, selectedVeganTypeResult] = await Promise.all([
        allergenIds.length
          ? supabase.from("allergens").select("id, name").in("id", allergenIds)
          : Promise.resolve({ data: [], error: null }),
        veganTypeId
          ? supabase.from("vegan_types").select("id, name").eq("id", veganTypeId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (selectedAllergiesResult.error || selectedVeganTypeResult.error) {
        throw selectedAllergiesResult.error ?? selectedVeganTypeResult.error;
      }

      allergies = (selectedAllergiesResult.data ?? []) as NamedRelation[];
      veganType = selectedVeganTypeResult.data as NamedRelation | null;

      if (allergies.length !== allergenIds.length || (veganTypeId && !veganType)) {
        return json({ error: "INVALID_CONDITIONS" }, 400);
      }
    }

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

    const allergenNameById = new Map(allergies.map(item => [item.id, item.name]));
    const allergyIdsByCategory = new Map<string, string[]>();
    for (const mapping of mappingResult.data ?? []) {
      const ids = allergyIdsByCategory.get(String(mapping.category_id)) ?? [];
      ids.push(String(mapping.allergen_id));
      allergyIdsByCategory.set(String(mapping.category_id), ids);
    }
    const veganCategoryIds = new Set(
      (veganRestrictionResult.data ?? []).map(item => String(item.category_id)),
    );
    const forbiddenCategoryIds = new Set([...allergyIdsByCategory.keys(), ...veganCategoryIds]);

    const recipe = recipeResult.data as Record<string, any>;
    const ingredients: OriginalIngredient[] = (recipe.recipe_ingredients ?? [])
      .map((row: Record<string, any>) => {
        const ingredient = one(row.ingredients);
        return ingredient
          ? {
              id: String(ingredient.id),
              name: String(ingredient.name),
              amount: row.amount == null ? null : String(row.amount),
              categoryId: ingredient.category_id == null ? null : String(ingredient.category_id),
              sortOrder: Number(row.sort_order),
            }
          : null;
      })
      .filter((item: OriginalIngredient | null): item is OriginalIngredient => Boolean(item))
      .sort((a: OriginalIngredient, b: OriginalIngredient) => a.sortOrder - b.sortOrder);
    const steps: OriginalStep[] = (recipe.recipe_steps ?? [])
      .filter(
        (step: Record<string, any>) => step.step_type === "detail" || step.step_type === "brief",
      )
      .map((step: Record<string, any>) => ({
        stepNumber: Number(step.step_number),
        description: String(step.description),
        stepType: step.step_type,
      }))
      .sort((a: OriginalStep, b: OriginalStep) => a.stepNumber - b.stepNumber);

    const restrictions: Restriction[] = ingredients.flatMap(ingredient => {
      if (!ingredient.categoryId) return [];
      const allergyNames = (allergyIdsByCategory.get(ingredient.categoryId) ?? [])
        .map(id => allergenNameById.get(id))
        .filter((name): name is string => Boolean(name));
      const veganRestricted = veganCategoryIds.has(ingredient.categoryId);
      if (!allergyNames.length && !veganRestricted) return [];
      return [
        {
          ingredient,
          allergyNames,
          veganRestricted,
          reason: buildReason(allergyNames, veganType?.name ?? "비건", veganRestricted),
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
        category => !forbiddenCategoryIds.has(String(category.id)),
      ),
    });
    let ai: AiRecipe | null = null;
    try {
      ai = alignReplacementOriginalIds(await callAlan(prompt), restrictions);
      validateAiRecipe(ai, restrictions, steps, forbiddenCategoryIds);
    } catch (outputError) {
      if (!isCorrectableAlanOutputError(outputError)) throw outputError;

      console.warn("Alan recipe response was invalid; resetting state and retrying once", {
        message:
          outputError instanceof Error ? outputError.message : "Unknown Alan output error",
        expectedOriginalIds: restrictions.map(item => item.ingredient.id),
        returnedOriginalIds: ai?.ingredients.map(item => item?.original_id) ?? [],
      });

      const correctionPrompt = createCorrectionPrompt(prompt, restrictions, steps);
      ai = alignReplacementOriginalIds(await callAlan(correctionPrompt, true), restrictions);
      validateAiRecipe(ai, restrictions, steps, forbiddenCategoryIds);
    }

    if (!ai) throw new Error("Alan did not return a custom recipe");

    const aiByOriginalId = new Map(ai.ingredients.map(item => [item.original_id, item]));
    const restrictionByOriginalId = new Map(restrictions.map(item => [item.ingredient.id, item]));
    const replacementIds = new Map<string, string>();
    for (const item of ai.ingredients) {
      replacementIds.set(
        item.original_id,
        await findOrCreateIngredient(supabase, item, forbiddenCategoryIds),
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
        cooking_time: Number.isFinite(ai.cooking_time) ? ai.cooking_time : recipe.cooking_time,
      })
      .select("id")
      .single();
    if (parentError) throw parentError;
    const customId = parent.id as string;

    try {
      const ingredientRows = ingredients.map(ingredient => {
        const replacement = aiByOriginalId.get(ingredient.id);
        return {
          ai_custom_recipe_id: customId,
          ingredient_id: replacementIds.get(ingredient.id) ?? ingredient.id,
          amount: replacement?.amount.trim() || ingredient.amount || "적당량",
          sort_order: ingredient.sortOrder,
        };
      });
      const stepRows = [
        ...ai.detail_steps.map(step => ({ ...step, step_type: "detail" })),
        ...ai.brief_steps.map(step => ({ ...step, step_type: "brief" })),
      ].map(step => ({
        ai_custom_recipe_id: customId,
        step_number: step.step_number,
        description: step.description.trim(),
        step_type: step.step_type,
      }));
      const substitutionRows = restrictions.map(item => ({
        ai_custom_recipe_id: customId,
        original_ingredient_id: item.ingredient.id,
        substitute_ingredient_id: replacementIds.get(item.ingredient.id)!,
        reason: restrictionByOriginalId.get(item.ingredient.id)!.reason,
      }));
      const allergyRows = allergenIds.map(allergenId => ({
        ai_custom_recipe_id: customId,
        allergen_id: allergenId,
      }));

      const results = await Promise.all([
        supabase.from("ai_custom_recipe_ingredients").insert(ingredientRows),
        supabase.from("ai_custom_recipe_steps").insert(stepRows),
        supabase.from("ai_custom_recipe_substitutions").insert(substitutionRows),
        allergyRows.length
          ? supabase.from("ai_custom_recipe_allergies").insert(allergyRows)
          : Promise.resolve({ error: null }),
      ]);
      const childError = results.find(result => result.error)?.error;
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
    const errorInfo = describeError(error);
    console.error("Custom recipe generation failed", errorInfo);
    return json(
      {
        error: "CUSTOM_RECIPE_GENERATION_FAILED",
        message: errorInfo.message,
        code: errorInfo.code,
      },
      500,
    );
  }
});
