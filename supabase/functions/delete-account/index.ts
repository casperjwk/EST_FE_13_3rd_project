import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);
  }
  if (!authorization) return json({ error: "UNAUTHORIZED" }, 401);

  // 요청을 보낸 사람이 실제로 로그인된 본인인지 확인 (일반 권한 클라이언트)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "UNAUTHORIZED" }, 401);
  const userId = authData.user.id;

  // 계정 삭제는 관리자 권한(service role)이 있어야만 가능
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // 자식 테이블부터 삭제 (ai_custom_recipes 삭제 시 관련 재료/조리단계/대체정보는 DB에서 함께 정리됨)
    const results = await Promise.all([
      adminClient.from("ai_custom_recipes").delete().eq("user_id", userId),
      adminClient.from("favorites").delete().eq("user_id", userId),
      adminClient.from("recent_views").delete().eq("user_id", userId),
      adminClient.from("user_allergies").delete().eq("user_id", userId),
    ]);
    const childError = results.find(result => result.error)?.error;
    if (childError) throw childError;

    const { error: profileError } = await adminClient.from("profiles").delete().eq("id", userId);
    if (profileError) throw profileError;

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) throw deleteUserError;

    return json({ status: "deleted" });
  } catch (error) {
    console.error("Account deletion failed", { userId, error });
    return json(
      {
        error: "ACCOUNT_DELETION_FAILED",
        message: error instanceof Error ? error.message : "Unknown deletion error",
      },
      500,
    );
  }
});
