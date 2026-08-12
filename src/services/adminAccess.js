import { supabase } from "../lib/supabase";

export async function getAdminAccessStatus() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return "signed-out";

  const { data: admins, error: adminError } = await supabase.from("admins").select("*");

  if (adminError) throw adminError;

  const userId = user.id.toLowerCase();
  const userEmail = user.email?.trim().toLowerCase() ?? "";
  const isAdmin = (admins ?? []).some(admin => {
    const registeredAdminId = admin.admin_id ?? admin.user_id ?? admin.id ?? admin.email;
    const normalizedAdminId = String(registeredAdminId ?? "").trim().toLowerCase();

    return normalizedAdminId === userId || (userEmail && normalizedAdminId === userEmail);
  });

  return isAdmin ? "allowed" : "denied";
}
