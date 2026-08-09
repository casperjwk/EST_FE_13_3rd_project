import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type GenerateRecipeRequest = {
  recipeId?: string;
};

type DietaryContext = {
  allergies: string[];
  veganType: string;
};

type GeneratedRecipe = {
  title: string;
  description: string;
  servings: number | null;
  cooking_time: number | null;
  difficulty: string | null;
  substitutions: Array<{
    original: string;
    replacement: string;
    reason: string;
  }>;
  ingredients: Array<{
    name: string;
    amount: string | null;
    category_id: string | null;
  }>;
  steps: Array<{
    step_number: number;
    description: string;
    step_type: "detail" | "brief";
  }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getDietaryContext(userMetadata: Record<string, unknown>): DietaryContext | null {
  const rawAllergies = userMetadata.allergies;
  const rawVeganType = userMetadata.veganType ?? userMetadata.vegan_type;

  if (!Array.isArray(rawAllergies) || typeof rawVeganType !== "string") {
    return null;
  }

  return {
    allergies: rawAllergies.filter((value): value is string => typeof value === "string"),
    veganType: rawVeganType,
  };
}

function createRecipePrompt(recipe: unknown, dietaryContext: DietaryContext) {
  return `
당신은 알레르기와 비건 조건을 지키는 맞춤 레시피 생성기입니다.

사용자 조건:
- 알레르기: ${dietaryContext.allergies.length ? dietaryContext.allergies.join(", ") : "없음"}
- 비건 유형: ${dietaryContext.veganType}

원본 레시피 JSON:
${JSON.stringify(recipe)}

사용자 조건에 맞지 않는 원본 재료를 찾아 안전한 재료로 대체하고, 대체 재료를
반영한 전체 레시피를 작성하세요. 알레르기 재료나 비건 조건에 맞지 않는 재료를
결과에 다시 포함하지 마세요.

반드시 아래 구조의 유효한 JSON 객체만 반환하세요. Markdown 코드 블록과 JSON
밖의 설명은 넣지 마세요.
{
  "title": "string",
  "description": "string",
  "servings": 2,
  "cooking_time": 20,
  "difficulty": "string",
  "substitutions": [
    { "original": "string", "replacement": "string", "reason": "string" }
  ],
  "ingredients": [
    { "name": "string", "amount": "string or null", "category_id": null }
  ],
  "steps": [
    { "step_number": 1, "description": "string", "step_type": "detail" }
  ]
}`.trim();
}

function extractAlanText(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const response = data as Record<string, unknown>;
  if (typeof response.answer === "string") return response.answer;
  if (typeof response.content === "string") return response.content;
  return null;
}

function parseGeneratedRecipe(text: string): GeneratedRecipe {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(normalized) as Partial<GeneratedRecipe>;

  if (
    typeof parsed.title !== "string" ||
    typeof parsed.description !== "string" ||
    !Array.isArray(parsed.substitutions) ||
    !Array.isArray(parsed.ingredients) ||
    !Array.isArray(parsed.steps)
  ) {
    throw new Error("Alan response does not match the required recipe shape");
  }

  for (const ingredient of parsed.ingredients) {
    if (!ingredient || typeof ingredient.name !== "string") {
      throw new Error("Alan response contains an invalid ingredient");
    }
  }

  for (const step of parsed.steps) {
    if (
      !step ||
      !Number.isInteger(step.step_number) ||
      typeof step.description !== "string" ||
      !["detail", "brief"].includes(step.step_type)
    ) {
      throw new Error("Alan response contains an invalid recipe step");
    }
  }

  return parsed as GeneratedRecipe;
}

async function requestAlanRecipe(prompt: string) {
  const apiBaseUrl =
    Deno.env.get("ALAN_API_BASE_URL") ?? "https://kdt-api-function.azurewebsites.net/api/v1";
  const clientId = Deno.env.get("ALAN_CLIENT_ID") ?? Deno.env.get("VITE_CLIENT_ID");

  if (!clientId) {
    throw new Error("ALAN_CLIENT_ID is not configured");
  }

  const url = new URL(`${apiBaseUrl.replace(/\/$/, "")}/question`);
  url.searchParams.set("content", prompt);
  url.searchParams.set("client_id", clientId);

  if (url.toString().length > 7500) {
    throw new Error("Alan request is too long for the GET endpoint");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Alan API request failed", { status: response.status, data });
    throw new Error(`Alan API returned ${response.status}`);
  }

  const answer = extractAlanText(data);
  if (!answer) {
    throw new Error("Alan API response has no answer or content field");
  }

  return parseGeneratedRecipe(answer);
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabasePublishableKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !supabasePublishableKey) {
    return jsonResponse({ error: "SERVER_CONFIGURATION_ERROR" }, 500);
  }

  if (!authorization) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }

  let body: GenerateRecipeRequest;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  if (!body.recipeId || typeof body.recipeId !== "string") {
    return jsonResponse({ error: "RECIPE_ID_REQUIRED" }, 400);
  }

  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }

  const dietaryContext = getDietaryContext(user.user_metadata ?? {});
  if (!dietaryContext) {
    return jsonResponse(
      {
        error: "DIETARY_PROFILE_NOT_FOUND",
        message: "Connect the user dietary tables before generating a custom recipe.",
      },
      422,
    );
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select(`
      id,
      title,
      description,
      servings,
      cooking_time,
      difficulty,
      recipe_ingredients (
        amount,
        sort_order,
        ingredients (id, name, category_id)
      ),
      recipe_steps (step_number, description, step_type)
    `)
    .eq("id", body.recipeId)
    .maybeSingle();

  if (recipeError) {
    console.error("Failed to load recipe", recipeError);
    return jsonResponse({ error: "RECIPE_QUERY_FAILED" }, 500);
  }

  if (!recipe) {
    return jsonResponse({ error: "RECIPE_NOT_FOUND" }, 404);
  }

  try {
    const generatedRecipe = await requestAlanRecipe(createRecipePrompt(recipe, dietaryContext));

    // DB 저장은 사용자 식단/AI 생성 테이블 구조 및 RLS 정책을 확인한 뒤 연결한다.
    return jsonResponse({
      status: "generated_not_saved",
      sourceRecipeId: recipe.id,
      generatedRecipe,
    });
  } catch (error) {
    console.error("Custom recipe generation failed", error);
    return jsonResponse(
      {
        error: "RECIPE_GENERATION_FAILED",
        message: error instanceof Error ? error.message : "Unknown generation error",
      },
      502,
    );
  }
});
