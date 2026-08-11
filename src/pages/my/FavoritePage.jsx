import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import "material-icons/iconfont/filled.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../../styles/global.css";
import styles from "./FavoritePage.module.css";
import { useAuth } from "../../context/AuthContext";
import { getFavoriteRecipes } from "../../services/favoriteService";

// 식단 조건 요약 카드 - 알레르기 비교 로직 붙기 전까지 목업 유지
const favoriteSummary = {
  userName: "홍길동",
  safeCount: 5,
  replaceableCount: 0,
  warningCount: 0,
  aiReplacedCount: 0,
  appliedConditions: [
    { label: "우유", type: "danger" },
    { label: "돼지고기", type: "danger" },
    { label: "플렉시테리언", type: "primary" },
  ],
};

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
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [favoriteRecipes, setFavoriteRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
        setFavoriteRecipes(
          recipes.map(recipe => ({
            id: recipe.id,
            name: recipe.title,
            description: recipe.description,
            imageUrl: recipe.image_url,
            difficulty: recipe.difficulty,
            time: recipe.cooking_time,
            servings: recipe.servings,
            likes: "22",
            status: "safe",
          })),
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

  const toggleFavorite = (id, event) => {
    event.stopPropagation();
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const goToRecipeDetail = id => {
    navigate(`/recipes/${id}`);
  };

  const goToRecipeList = () => {
    navigate("/recipes");
  };

  const hasFavorites = !isLoading && !errorMessage && favoriteRecipes.length > 0;
  const showEmptyState = !isLoading && !errorMessage && favoriteRecipes.length === 0;

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
                  {favoriteSummary.userName}님의 즐겨찾기 {favoriteRecipes.length}개 기준
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
                <p className={`${styles.statNumber} ${styles.statColorSafe}`}>
                  {favoriteSummary.safeCount}
                </p>
                <p className={`${styles.statLabel} ${styles.statColorSafe}`}>안전</p>
                <p className={styles.statDesc}>안전 레시피</p>
              </div>
              <div className={styles.statItem}>
                <p className={`${styles.statNumber} ${styles.statColorReplace}`}>
                  {favoriteSummary.replaceableCount}
                </p>
                <p className={`${styles.statLabel} ${styles.statColorReplace}`}>대체 가능</p>
                <p className={styles.statDesc}>대체 재료 추천</p>
              </div>
              <div className={styles.statItem}>
                <p className={`${styles.statNumber} ${styles.statColorWarning}`}>
                  {favoriteSummary.warningCount}
                </p>
                <p className={`${styles.statLabel} ${styles.statColorWarning}`}>주의 감지</p>
                <p className={styles.statDesc}>알레르기 포함</p>
              </div>
              <div className={styles.statItem}>
                <p className={`${styles.statNumber} ${styles.statColorReplaced}`}>
                  {favoriteSummary.aiReplacedCount}
                </p>
                <p className={`${styles.statLabel} ${styles.statColorReplaced}`}>AI 대체 완료</p>
                <p className={styles.statDesc}>대체 레시피</p>
              </div>
            </div>
          </div>

          <div className={styles.appliedConditions}>
            <p className={styles.appliedLabel}>적용 조건</p>
            <div className={styles.conditionChipList}>
              {favoriteSummary.appliedConditions.map(condition => (
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
            const isFavorite = favoriteIds.has(recipe.id);
            return (
              <div
                key={recipe.id}
                className={styles.cardItem}
                onClick={() => goToRecipeDetail(recipe.id)}
              >
                <div className={styles.cardImageWrap}>
                  <img src={recipe.imageUrl} alt={recipe.name} className={styles.cardImage} />
                  <span
                    className={`${styles.cardDifficulty} ${styles[difficultyStyles[recipe.difficulty]]}`}
                  >
                    {difficultyLabels[recipe.difficulty]}
                  </span>
                  <button
                    type="button"
                    className={`${styles.cardFavoriteBtn} ${
                      isFavorite ? styles.cardFavoriteBtnActive : ""
                    }`}
                    aria-label="즐겨찾기"
                    onClick={event => toggleFavorite(recipe.id, event)}
                  >
                    <i className={isFavorite ? "fa-solid fa-heart" : "fa-regular fa-heart"} />
                  </button>
                </div>
                <div className={styles.cardInfo}>
                  <p className={styles.cardName}>{recipe.name}</p>
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
                    <span className={styles.cardStatusRight}>
                      {recipe.status === "safe" && (
                        <span className="material-icons" aria-hidden="true">
                          {statusConfig[recipe.status].rightIcon}
                        </span>
                      )}
                      {statusConfig[recipe.status].rightText}
                      {recipe.status !== "safe" && (
                        <span className="material-icons" aria-hidden="true">
                          {statusConfig[recipe.status].rightIcon}
                        </span>
                      )}
                    </span>
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
