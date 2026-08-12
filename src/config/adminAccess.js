export const ALLOWED_ADMIN_EMAILS = ["qwerty@naver.com", "admin@han77ilab.com"];

export function isAllowedAdminEmail(email) {
  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  return ALLOWED_ADMIN_EMAILS.includes(normalizedEmail);
}
