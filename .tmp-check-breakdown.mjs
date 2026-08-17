import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_KEY = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const { data } = await supabase.auth.signInWithPassword({
  email: "ckck912ck@gmail.com",
  password: "123456",
});
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const storageKey = `sb-${projectRef}-auth-token`;

const userId = data.user.id;
const { data: originalFavorites } = await supabase.from("favorites").select("recipe_id").eq("user_id", userId);
const { data: allRecipes } = await supabase.from("recipes").select("id");
const originalIds = new Set(originalFavorites.map(f => f.recipe_id));
const toAdd = allRecipes.filter(r => !originalIds.has(r.id)).map(r => ({ user_id: userId, recipe_id: r.id }));
if (toAdd.length > 0) await supabase.from("favorites").insert(toAdd);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [storageKey, JSON.stringify(data.session)]);
await page.goto("http://localhost:5180/favorite", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

let info = null;
for (let p = 1; p <= 6 && !info; p++) {
  await page.goto(`http://localhost:5180/favorite?page=${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('[class*="_cardItem_"]')];
  // 수프카레(2줄) 카드 찾기
  const target = cards.find(c => c.querySelector('[class*="_cardName_"]')?.textContent.includes("수프카레"));
  if (!target) return null;

  const measure = el => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      height: Math.round(rect.height),
      marginTop: cs.marginTop,
      marginBottom: cs.marginBottom,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      borderTop: cs.borderTopWidth,
      borderBottom: cs.borderBottomWidth,
    };
  };

  const imageWrap = target.querySelector('[class*="_cardImageWrap_"]');
  const info_ = target.querySelector('[class*="_cardInfo_"]');
  const name = target.querySelector('[class*="_cardName_"]');
  const desc = target.querySelector('[class*="_cardDescription_"]');
  const meta = target.querySelector('[class*="_cardMeta_"]');
  const status = target.querySelector('[class*="_cardStatus_"]');

  return {
    cardItemTotal: Math.round(target.getBoundingClientRect().height),
    cardItemBorder: getComputedStyle(target).borderTopWidth,
    imageWrap: measure(imageWrap),
    cardInfo: measure(info_),
    cardInfoPadding: getComputedStyle(info_).padding,
    name: measure(name),
    desc: measure(desc),
    meta: measure(meta),
    status: measure(status),
  };
  });
}
console.log(JSON.stringify(info, null, 2));

const addedIds = toAdd.map(t => t.recipe_id);
if (addedIds.length > 0) {
  await supabase.from("favorites").delete().eq("user_id", userId).in("recipe_id", addedIds);
}
await browser.close();
await supabase.auth.signOut();
