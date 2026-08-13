import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import "material-icons/iconfont/filled.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../../styles/global.css";
import styles from "./FavoritePage.module.css";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  getFavoriteRecipes,
  removeFavorite,
  getFavoriteCounts,
  getCustomRecipeCacheEntries,
} from "../../services/favoriteService";
import { getUserSafetyConditions, getRecipeSafetyStatus } from "../../utils/recipeSafety";

const safetyTypeToStatus = {
  safe: "safe",
  danger: "warning",
  needReplacement: "replaceable",
};

function sortedUniqueIds(ids) {
  return [...new Set((ids ?? []).map(String))].sort();
}

function sameIdSet(a, b) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

const difficultyStyles = {
  easy: "cardDifficultyEasy",
  normal: "cardDifficultyNormal",
  hard: "cardDifficultyHard",
};

const difficultyLabels = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

const statusConfig = {
  safe: {
    title: "안전",
    desc: "제한 재료 없음",
    rightIcon: "check",
    rightText: "안전",
    colorClass: "cardStatusSafe",
  },
  replaceable: {
    title: "대체 가능",
    desc: "대체 재료 추천 있음",
    rightIcon: "arrow_forward",
    rightText: "추천 보기",
    colorClass: "cardStatusReplace",
  },
  warning: {
    title: "주의 감지",
    desc: "알레르기 재료 포함",
    rightIcon: "arrow_forward",
    rightText: "상세 확인",
    colorClass: "cardStatusWarning",
  },
  replaced: {
    title: "AI 대체 완료",
    desc: "맞춤 대체 레시피 준비됨",
    rightIcon: "arrow_forward",
    rightText: "대체 레시피 보기",
    colorClass: "cardStatusReplaced",
  },
};

function FavoritePage() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const [favoriteRecipes, setFavoriteRecipes] = useState([]);
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [summaryNickname, setSummaryNickname] = useState("");
  const [appliedConditions, setAppliedConditions] = useState([]);

  useEffect(() => {
    if (authLoading || authUser) {
      return;
    }
    navigate("/login");
  }, [authUser, authLoading, navigate]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authUser) {
      setSummaryNickname("");
      setAppliedConditions([]);
      return;
    }

    async function loadDietSummary() {
      const [{ data: profileData }, { data: allergyRows }, { data: allergensList }, { data: veganTypesList }] =
        await Promise.all([
          supabase.from("profiles").select("nickname, vegan_type_id").eq("id", authUser.id).maybeSingle(),
          supabase.from("user_allergies").select("allergen_id").eq("user_id", authUser.id),
          supabase.from("allergens").select("id, name"),
          supabase.from("vegan_types").select("id, name"),
        ]);

      setSummaryNickname(profileData?.nickname || "사용자");

      const allergenNameById = new Map((allergensList ?? []).map(a => [a.id, a.name]));
      const veganNameById = new Map((veganTypesList ?? []).map(v => [v.id, v.name]));

      const conditions = (allergyRows ?? []).map(row => ({
        label: allergenNameById.get(row.allergen_id) ?? row.allergen_id,
        type: "danger",
      }));
      conditions.push({
        label: veganNameById.get(profileData?.vegan_type_id) ?? "일반",
        type: "primary",
      });

      setAppliedConditions(conditions);
    }

    loadDietSummary();
  }, [authUser, authLoading]);

  useEffect(() => {
    async function loadFavoriteRecipes() {
      if (authLoading) {
        return;
      }

      if (!authUser) {
        setFavoriteRecipes([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const recipes = await getFavoriteRecipes(authUser.id);
        const recipeIds = recipes.map(recipe => recipe.id);
        const [favoriteCounts, safetyConditions, cacheEntries] = await Promise.all([
          getFavoriteCounts(recipeIds),
          getUserSafetyConditions(authUser.id),
          getCustomRecipeCacheEntries(authUser.id, recipeIds),
        ]);

        const currentVeganTypeId = safetyConditions?.veganTypeId ?? null;
        const currentAllergenIds = sortedUniqueIds(safetyConditions?.allergenIds);

        setFavoriteRecipes(
          recipes.map(recipe => {
            const { safetyType } = getRecipeSafetyStatus(recipe, safetyConditions);
            let status = safetyTypeToStatus[safetyType] ?? "safe";

            if (status === "replaceable") {
              const hasSavedReplacement = cacheEntries.some(entry => {
                if (entry.original_recipe_id !== recipe.id) return false;
                if ((entry.vegan_type_id ?? null) !== currentVeganTypeId) return false;
                const entryAllergenIds = sortedUniqueIds(
                  (entry.ai_custom_recipe_allergies ?? []).map(a => a.allergen_id),
                );
                return sameIdSet(entryAllergenIds, currentAllergenIds);
              });
              if (hasSavedReplacement) status = "replaced";
            }

            return {
              id: recipe.id,
              name: recipe.title,
              description: recipe.description,
              imageUrl: recipe.image_url,
              difficulty: recipe.difficulty,
              time: recipe.cooking_time,
              servings: recipe.servings,
              likes: favoriteCounts[recipe.id] ?? 0,
              status,
            };
          }),
        );
      } catch (error) {
        console.error("[HankkiLab] 즐겨찾기 레시피 조회 실패", error);
        setErrorMessage("즐겨찾기한 레시피를 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadFavoriteRecipes();
  }, [authUser, authLoading]);

  const unfavorite = async (recipeId, event) => {
    event.stopPropagation();
    if (!authUser || removingIds.has(recipeId)) return;

    setRemovingIds(prev => new Set(prev).add(recipeId));
    try {
      await removeFavorite(authUser.id, recipeId);
      setFavoriteRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
    } catch (error) {
      console.error("[HankkiLab] 즐겨찾기 삭제 실패", error);
      alert("즐겨찾기에서 삭제하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(recipeId);
        return next;
      });
    }
  };

  const goToRecipeDetail = id => {
    navigate(`/recipes/${id}`);
  };

  const goToRecipeList = () => {
    navigate("/recipes");
  };

  const hasFavorites = !isLoading && !errorMessage && favoriteRecipes.length > 0;
  const showEmptyState = !isLoading && !errorMessage && favoriteRecipes.length === 0;

  const safeCount = favoriteRecipes.filter(recipe => recipe.status === "safe").length;
  const replaceableCount = favoriteRecipes.filter(recipe => recipe.status === "replaceable").length;
  const warningCount = favoriteRecipes.filter(recipe => recipe.status === "warning").length;
  const aiReplacedCount = favoriteRecipes.filter(recipe => recipe.status === "replaced").length;

  return (
    <div className={styles.favoritePage}>
      <div className={`container ${styles.favoritePageInner}`}>
        <h2 className={styles.title}>
          즐겨찾기
          <span className={styles.countBadge}>{favoriteRecipes.length}개</span>
        </h2>
        <p className={styles.subtitle}>
          {showEmptyState ? (
            <>
              마음에 드는 레시피를 즐겨찾기에 추가하면{" "}
              <br className={styles.subtitleBreak} />
              식단 조건에 맞는지 바로 확인해드려요.
            </>
          ) : (
            "저장한 레시피를 내 식단 조건에 맞게 확인했어요."
          )}
        </p>

        {isLoading && <p className={styles.subtitle}>불러오는 중...</p>}
        {!isLoading && errorMessage && <p className={styles.subtitle}>{errorMessage}</p>}

        {showEmptyState && (
          <div className={styles.emptyState}>
            <span className={`material-icons ${styles.emptyIcon}`} aria-hidden="true">
              favorite_border
            </span>
            <p className={styles.emptyTitle}>아직 즐겨찾기한 레시피가 없어요</p>
            <p className={styles.emptyDesc}>마음에 드는 레시피를 즐겨찾기에 추가해보세요!</p>
            <button type="button" className={styles.emptyButton} onClick={goToRecipeList}>
              레시피 둘러보기
            </button>
          </div>
        )}

        {hasFavorites && (
          <>
          <section className={styles.summaryCard}>
          <div className={styles.summaryTop}>
            <div className={styles.summaryHeader}>
              <p className={styles.summaryTitle}>
                <span className={`material-icons ${styles.summaryTitleSparkle}`} aria-hidden="true">
                  auto_fix_high
                </span>
                <span className={styles.summaryTitleHighlight}>식단 조건 요약</span>
                <span className={`material-icons ${styles.summaryTitleDivider}`} aria-hidden="true">
                  horizontal_rule
                </span>
                <span className={styles.summaryTitleMuted}>
                  {summaryNickname}님의 즐겨찾기 {favoriteRecipes.length}개 기준
                </span>
              </p>
              <span className={styles.summaryStatusBadge}>
                <span className="material-icons" aria-hidden="true">
                  smart_toy
                </span>
                확인 완료
              </span>
            </div>

            <div className={styles.summaryStats}>
              <div className={styles.statItem}>
                <p className={`${styles.statNumber} ${styles.statColorSafe}`}>{safeCount}</p>
                <p className={`${styles.statLabel} ${styles.statColorSafe}`}>안전</p>
                <p className={styles.statDesc}>안전 레시피</p>
              </div>
              <div className={styles.statItem}>
                <p className={`${styles.statNumber} ${styles.statColorReplace}`}>
                  {replaceableCount}
                </p>
                <p className={`${styles.statLabel} ${styles.statColorReplace}`}>대체 가능</p>
                <p className={styles.statDesc}>대체 재료 추천</p>
              </div>
              <div className={styles.statItem}>
                <p className={`${styles.statNumber} ${styles.statColorWarning}`}>{warningCount}</p>
                <p className={`${styles.statLabel} ${styles.statColorWarning}`}>주의 감지</p>
                <p className={styles.statDesc}>알레르기 포함</p>
              </div>
              <div className={styles.statItem}>
                <p className={`${styles.statNumber} ${styles.statColorReplaced}`}>
                  {aiReplacedCount}
                </p>
                <p className={`${styles.statLabel} ${styles.statColorReplaced}`}>AI 대체 완료</p>
                <p className={styles.statDesc}>대체 레시피</p>
              </div>
            </div>
          </div>

          <div className={styles.appliedConditions}>
            <p className={styles.appliedLabel}>적용 조건</p>
            <div className={styles.conditionChipList}>
              {appliedConditions.map(condition => (
                <span
                  key={condition.label}
                  className={
                    condition.type === "danger"
                      ? styles.conditionChipDanger
                      : styles.conditionChipPrimary
                  }
                >
                  {condition.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.cardGrid}>
          {favoriteRecipes.map(recipe => {
            return (
              <div key={recipe.id} className={styles.cardItem}>
                <div
                  className={styles.cardImageWrap}
                  onClick={() => goToRecipeDetail(recipe.id)}
                >
                  <img src={recipe.imageUrl} alt={recipe.name} className={styles.cardImage} />
                  <span
                    className={`${styles.cardDifficulty} ${styles[difficultyStyles[recipe.difficulty]]}`}
                  >
                    {difficultyLabels[recipe.difficulty]}
                  </span>
                  <button
                    type="button"
                    className={`${styles.cardFavoriteBtn} ${styles.cardFavoriteBtnActive}`}
                    aria-label="즐겨찾기 삭제"
                    disabled={removingIds.has(recipe.id)}
                    onClick={event => unfavorite(recipe.id, event)}
                  >
                    <i className="fa-solid fa-heart" />
                  </button>
                </div>
                <div className={styles.cardInfo}>
                  <p
                    className={styles.cardName}
                    onClick={() => goToRecipeDetail(recipe.id)}
                  >
                    {recipe.name}
                  </p>
                  <p className={styles.cardDescription}>{recipe.description}</p>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardMetaItem}>
                      <span className="material-icons" aria-hidden="true">
                        timer
                      </span>
                      {recipe.time}분
                    </span>
                    <span className={styles.cardMetaItem}>
                      <span className="material-icons" aria-hidden="true">
                        person
                      </span>
                      {recipe.servings}인분
                    </span>
                    <span className={`${styles.cardMetaItem} ${styles.cardMetaItemLikes}`}>
                      <span className="material-icons" aria-hidden="true">
                        favorite
                      </span>
                      {recipe.likes}
                    </span>
                  </div>
                  <div
                    className={`${styles.cardStatus} ${styles[statusConfig[recipe.status].colorClass]}`}
                  >
                    <span className={styles.cardStatusLeft}>
                      <span className="material-icons" aria-hidden="true">
                        smart_toy
                      </span>
                      <span className={styles.cardStatusText}>
                        <span className={styles.cardStatusTitle}>
                          {statusConfig[recipe.status].title}
                        </span>
                        <span className={styles.cardStatusDesc}>
                          {statusConfig[recipe.status].desc}
                        </span>
                      </span>
                    </span>
                    {recipe.status === "safe" ? (
                      <span className={styles.cardStatusRight}>
                        <span className="material-icons" aria-hidden="true">
                          {statusConfig[recipe.status].rightIcon}
                        </span>
                        {statusConfig[recipe.status].rightText}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.cardStatusRight}
                        onClick={() => goToRecipeDetail(recipe.id)}
                      >
                        {statusConfig[recipe.status].rightText}
                        <span className="material-icons" aria-hidden="true">
                          {statusConfig[recipe.status].rightIcon}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FavoritePage;
