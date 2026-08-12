import { supabase } from "../lib/supabase";

export async function getAdminAccessStatus() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return "signed-out";

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (adminError) throw adminError;
  return admin ? "allowed" : "denied";
}
