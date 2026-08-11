import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import "material-icons/iconfont/filled.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../../styles/global.css";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { getRecentlyViewedRecipes } from "../../services/recentViewService";
import {
  getFavoriteRecipeIds,
  addFavorite,
  removeFavorite,
  getFavoriteCounts,
} from "../../services/favoriteService";
import styles from "./MyPage.module.css";

// 즐겨찾기 개수는 아직 실제 집계 로직 없어서 목업 유지

// DB(vegan_types 테이블)의 id와 맞춰야 저장이 정상 동작함
const veganTypes = [
  { id: "general", label: "일반", desc: "제한 없음" },
  {
    id: "flexitarian",
    label: "플렉시테리언",
    desc: "주로 채식, 가끔 육류 허용",
    descBreak: ["주로 채식, ", "가끔 육류 허용"],
    descBreakFrom: "tablet",
  },
  { id: "pollo", label: "플로", desc: "닭고기까지 허용" },
  {
    id: "pesco",
    label: "페스코",
    desc: "생선·해산물까지 허용",
    descBreak: ["생선·해산물까지 ", "허용"],
    descBreakFrom: "desktop",
  },
  { id: "lacto_ovo", label: "락토-오보", desc: "유제품·달걀 허용" },
  { id: "lacto", label: "락토", desc: "유제품만 허용" },
  { id: "ovo", label: "오보", desc: "달걀만 허용" },
  {
    id: "vegan",
    label: "비건",
    desc: "동물성 식품 안전 제외",
    descBreak: ["동물성 식품 ", "안전 제외"],
    descBreakFrom: "desktop",
  },
];

const DEFAULT_VEGAN_TYPE_ID = "general";

const difficultyStyles = {
  easy: "recentDifficultyEasy",
  normal: "recentDifficultyNormal",
  hard: "recentDifficultyHard",
};

const difficultyLabels = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

function MyPage() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const [photoUrl, setPhotoUrl] = useState(null);
  const [allergyOptions, setAllergyOptions] = useState([]);
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [selectedVeganType, setSelectedVeganType] = useState(DEFAULT_VEGAN_TYPE_ID);
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState(() => new Set());
  const [recentRecipes, setRecentRecipes] = useState([]);
  const [nickname, setNickname] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isDietLoading, setIsDietLoading] = useState(true);
  const [isEditingDiet, setIsEditingDiet] = useState(false);
  const [isSavingDiet, setIsSavingDiet] = useState(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authUser) {
      setNickname("");
      setIsProfileLoading(false);
      return;
    }

    let isActive = true;
    setIsProfileLoading(true);

    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", authUser.id)
        .maybeSingle();
      if (!isActive) return;
      if (error) {
        console.error("[MyPage] profile fetch error:", error);
        setIsProfileLoading(false);
        return;
      }
      setNickname(data?.nickname ?? "");
      setIsProfileLoading(false);
    }

    loadProfile();
    return () => {
      isActive = false;
    };
  }, [authUser, authLoading]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authUser) {
      setSelectedAllergies([]);
      setSelectedVeganType(DEFAULT_VEGAN_TYPE_ID);
      setIsDietLoading(false);
      return;
    }

    let isActive = true;
    setIsDietLoading(true);

    async function loadDiet() {
      const [{ data: profileData, error: profileError }, { data: allergyRows, error: allergyError }] =
        await Promise.all([
          supabase.from("profiles").select("vegan_type_id").eq("id", authUser.id).maybeSingle(),
          supabase.from("user_allergies").select("allergen_id").eq("user_id", authUser.id),
        ]);
      if (!isActive) return;

      if (profileError) {
        console.error("[MyPage] vegan_type_id fetch error:", profileError);
      } else {
        setSelectedVeganType(profileData?.vegan_type_id ?? DEFAULT_VEGAN_TYPE_ID);
      }

      if (allergyError) {
        console.error("[MyPage] user_allergies fetch error:", allergyError);
      } else {
        setSelectedAllergies(allergyRows.map(row => row.allergen_id));
      }

      setIsDietLoading(false);
    }

    loadDiet();
    return () => {
      isActive = false;
    };
  }, [authUser, authLoading]);

  useEffect(() => {
    let isActive = true;

    async function loadAllergens() {
      const { data, error } = await supabase.from("allergens").select("id, name");
      if (!isActive) return;
      if (error) {
        console.error("[MyPage] allergens fetch error:", error);
        return;
      }
      setAllergyOptions(data);
    }

    loadAllergens();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    async function loadRecentlyViewed() {
      if (authLoading) {
        return;
      }

      if (!authUser) {
        setRecentRecipes([]);
        return;
      }

      try {
        const recipes = await getRecentlyViewedRecipes(authUser.id);
        const favoriteCounts = await getFavoriteCounts(recipes.map(recipe => recipe.id));
        setRecentRecipes(
          recipes.map(recipe => ({
            id: recipe.id,
            name: recipe.title,
            imageUrl: recipe.image_url,
            difficulty: recipe.difficulty,
            time: recipe.cooking_time,
            servings: recipe.servings,
            likes: favoriteCounts[recipe.id] ?? 0,
          })),
        );
      } catch (error) {
        console.error("[MyPage] 최근 본 레시피 조회 실패", error);
      }
    }

    loadRecentlyViewed();
  }, [authUser, authLoading]);

  useEffect(() => {
    async function loadFavoriteIds() {
      if (authLoading || !authUser) {
        setFavoriteRecipeIds(new Set());
        return;
      }

      try {
        const ids = await getFavoriteRecipeIds(authUser.id);
        setFavoriteRecipeIds(new Set(ids));
      } catch (error) {
        console.error("[MyPage] 즐겨찾기 여부 조회 실패", error);
      }
    }

    loadFavoriteIds();
  }, [authUser, authLoading]);

  const goToRecipeDetail = id => {
    navigate(`/recipes/${id}`);
  };

  const toggleRecentFavorite = async (id, event) => {
    event.stopPropagation();
    if (!authUser) return;

    const isCurrentlyFavorite = favoriteRecipeIds.has(id);
    try {
      if (isCurrentlyFavorite) {
        await removeFavorite(authUser.id, id);
      } else {
        await addFavorite(authUser.id, id);
      }
    } catch (error) {
      console.error("[MyPage] 즐겨찾기 변경 실패", error);
      alert("즐겨찾기 상태를 변경하지 못했습니다. 다시 시도해주세요.");
      return;
    }

    setFavoriteRecipeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    setRecentRecipes(prev =>
      prev.map(recipe =>
        recipe.id === id
          ? { ...recipe, likes: recipe.likes + (isCurrentlyFavorite ? -1 : 1) }
          : recipe,
      ),
    );
  };

  const handlePhotoChange = event => {
    const file = event.target.files[0];
    if (!file) return;
    setPhotoUrl(URL.createObjectURL(file));
  };

  const toggleAllergy = allergenId => {
    setSelectedAllergies(prev =>
      prev.includes(allergenId) ? prev.filter(item => item !== allergenId) : [...prev, allergenId],
    );
  };

  const startEditingDiet = () => {
    setIsEditingDiet(true);
  };

  const cancelEditingDiet = async () => {
    if (!authUser) {
      setIsEditingDiet(false);
      return;
    }

    const [{ data: profileData }, { data: allergyRows }] = await Promise.all([
      supabase.from("profiles").select("vegan_type_id").eq("id", authUser.id).maybeSingle(),
      supabase.from("user_allergies").select("allergen_id").eq("user_id", authUser.id),
    ]);
    setSelectedVeganType(profileData?.vegan_type_id ?? DEFAULT_VEGAN_TYPE_ID);
    setSelectedAllergies((allergyRows ?? []).map(row => row.allergen_id));
    setIsEditingDiet(false);
  };

  const saveDiet = async () => {
    if (!authUser || isSavingDiet) return;

    setIsSavingDiet(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ vegan_type_id: selectedVeganType })
        .eq("id", authUser.id);
      if (profileError) throw profileError;

      const { error: deleteError } = await supabase
        .from("user_allergies")
        .delete()
        .eq("user_id", authUser.id);
      if (deleteError) throw deleteError;

      if (selectedAllergies.length > 0) {
        const { error: insertError } = await supabase.from("user_allergies").insert(
          selectedAllergies.map(allergenId => ({ user_id: authUser.id, allergen_id: allergenId })),
        );
        if (insertError) throw insertError;
      }

      setIsEditingDiet(false);
    } catch (error) {
      console.error("[MyPage] 식단 정보 저장 실패", error);
      alert("식단 정보를 저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setIsSavingDiet(false);
    }
  };

  const recentScrollRef = useRef(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateRecentScrollState = () => {
    const el = recentScrollRef.current;
    if (!el) return;
    setCanScrollPrev(el.scrollLeft > 0);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateRecentScrollState();
  }, [recentRecipes]);

  const scrollRecent = direction => {
    const el = recentScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 215, behavior: "smooth" });
  };

  return (
    <div className={styles.myPage}>
      <div className={`container ${styles.myPageInner}`}>
        <h2 className={styles.myPageTitle}>
          <span className="material-icons" aria-hidden="true">
            face
          </span>
          My Page
        </h2>

        <section className={styles.profileCard}>
          <div className={styles.profileCardLeft}>
            <label
              className={`${styles.profileCardAvatar} ${photoUrl ? "" : styles.profileCardAvatarEmpty}`}
            >
              {photoUrl && <img src={photoUrl} alt="프로필 사진" />}
              <span className={`material-icons ${styles.profileCardAvatarEdit}`} aria-hidden="true">
                photo_camera
              </span>
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </label>

            <div className={styles.profileCardText}>
              {!isProfileLoading && (
                <p className={styles.profileCardName}>{nickname || "사용자"}</p>
              )}
              <p className={styles.profileCardEmail}>{authUser?.email ?? ""}</p>
            </div>
          </div>

          <div className={styles.profileCardDivider} />

          <div className={styles.profileCardRight}>
            <div className={styles.profileCardFavoriteStat}>
              <p className={styles.profileCardFavoriteCount}>{favoriteRecipeIds.size}</p>
              <p className={styles.profileCardFavoriteLabel}>즐겨찾기</p>
            </div>
            <Link to="/favorite" className={styles.profileCardFavoriteBtn}>
              <span className="material-icons" aria-hidden="true">
                favorite_border
              </span>
              즐겨찾기 보기
            </Link>
          </div>
        </section>

        {!isDietLoading && (
        <section className={styles.dietCard}>
          <div className={styles.dietCardHeader}>
            <h3 className={styles.dietCardTitle}>식단 정보</h3>
            {isEditingDiet ? (
              <div className={styles.dietEditActions}>
                <button
                  type="button"
                  className={styles.dietCancelBtn}
                  onClick={cancelEditingDiet}
                  disabled={isSavingDiet}
                >
                  <span className="material-icons" aria-hidden="true">
                    close
                  </span>
                  취소
                </button>
                <button
                  type="button"
                  className={styles.dietSaveBtn}
                  onClick={saveDiet}
                  disabled={isSavingDiet}
                >
                  <span className="material-icons" aria-hidden="true">
                    save
                  </span>
                  {isSavingDiet ? "저장 중..." : "저장"}
                </button>
              </div>
            ) : (
              <button type="button" className={styles.dietEditBtn} onClick={startEditingDiet}>
                <span className="material-icons" aria-hidden="true">
                  edit
                </span>
                수정
              </button>
            )}
          </div>

          {isEditingDiet ? (
            <>
              <div className={styles.dietRow}>
                <p className={styles.dietLabel}>
                  <span className={`material-icons ${styles.dietLabelIconWarning}`} aria-hidden="true">
                    warning_amber
                  </span>
                  알레르기 정보
                </p>
                <p className={`${styles.dietDescription} ${styles.allergyDescription}`}>
                  해당하는 알레르기를 모두 선택해주세요. 레시피 검색 시 자동으로 적용됩니다.
                </p>
                <div className={styles.allergyChipGrid}>
                  {allergyOptions.map(allergy => (
                    <button
                      key={allergy.id}
                      type="button"
                      onClick={() => toggleAllergy(allergy.id)}
                      className={`${styles.allergyChip} ${
                        selectedAllergies.includes(allergy.id) ? styles.allergyChipSelected : ""
                      }`}
                    >
                      {allergy.name}
                    </button>
                  ))}
                </div>
                {selectedAllergies.length === 0 && (
                  <p className={styles.dietNoticeText}>선택한 알레르기가 없습니다.</p>
                )}
              </div>

              <div className={styles.dietRow}>
                <p className={styles.dietLabel}>
                  <span className={`material-icons ${styles.dietLabelIconEco}`} aria-hidden="true">
                    spa
                  </span>
                  비건 유형
                </p>
                <p className={styles.dietDescription}>
                  비건 유형은 알레르기와 별개 기준입니다. 가장 가까운 식단 유형을 선택하세요.
                </p>
                <div className={styles.veganCardGrid}>
                  {veganTypes.map(type => (
                    <label key={type.id} className={styles.veganCard}>
                      <input
                        type="radio"
                        name="veganType"
                        className={styles.veganCardRadio}
                        checked={type.id === selectedVeganType}
                        onChange={() => setSelectedVeganType(type.id)}
                      />
                      <span className={styles.veganCardText}>
                        <span className={styles.veganCardLabel}>{type.label}</span>
                        <span className={styles.veganCardDesc}>
                          {type.descBreak ? (
                            <>
                              {type.descBreak[0]}
                              <br
                                className={
                                  type.descBreakFrom === "desktop"
                                    ? styles.veganCardBreakDesktop
                                    : styles.veganCardBreak
                                }
                              />
                              {type.descBreak[1]}
                            </>
                          ) : (
                            type.desc
                          )}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.dietRow}>
                <p className={styles.dietLabel}>
                  <span className={`material-icons ${styles.dietLabelIconWarning}`} aria-hidden="true">
                    warning_amber
                  </span>
                  알레르기 정보
                </p>
                {selectedAllergies.length === 0 ? (
                  <p className={`${styles.dietNoticeText} ${styles.dietViewValue}`}>
                    등록된 알레르기 정보가 없어요.
                  </p>
                ) : (
                  <div className={`${styles.dietChipList} ${styles.dietViewValue}`}>
                    {selectedAllergies.map(allergenId => (
                      <span key={allergenId} className={styles.dietChipDanger}>
                        {allergyOptions.find(a => a.id === allergenId)?.name ?? allergenId}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.dietRow}>
                <p className={styles.dietLabel}>
                  <span className={`material-icons ${styles.dietLabelIconEco}`} aria-hidden="true">
                    spa
                  </span>
                  비건 유형
                </p>
                <div className={`${styles.dietChipList} ${styles.dietViewValue}`}>
                  <span className={styles.dietChipPrimary}>
                    {veganTypes.find(type => type.id === selectedVeganType)?.label ?? "일반"}
                  </span>
                </div>
              </div>
            </>
          )}
        </section>
        )}

        {!isDietLoading && isEditingDiet && (
        <section className={styles.appliedCard}>
          <h3 className={styles.appliedTitle}>현재 적용 중인 조건</h3>
          <p className={styles.dietDescription}>레시피 검색 시 자동으로 적용되는 조건이에요.</p>
          <div className={styles.dietChipList}>
            {selectedAllergies.map(allergenId => (
              <span key={allergenId} className={styles.dietChipDanger}>
                {allergyOptions.find(a => a.id === allergenId)?.name ?? allergenId} 제외
              </span>
            ))}
            <span className={styles.dietChipPrimary}>
              {veganTypes.find(type => type.id === selectedVeganType)?.label ?? "일반"}
            </span>
          </div>
        </section>
        )}

        {recentRecipes.length > 0 && (
        <section className={styles.recentCard}>
          <div className={styles.recentHeader}>
            <h3 className={styles.recentTitle}>최근 본 레시피</h3>
            <div className={styles.recentSlideBtns}>
              <button
                type="button"
                className={styles.recentSlideBtn}
                aria-label="이전 레시피"
                disabled={!canScrollPrev}
                onClick={() => scrollRecent(-1)}
              >
                <span className="material-icons" aria-hidden="true">
                  chevron_left
                </span>
              </button>
              <button
                type="button"
                className={styles.recentSlideBtn}
                aria-label="다음 레시피"
                disabled={!canScrollNext}
                onClick={() => scrollRecent(1)}
              >
                <span className="material-icons" aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>
          </div>

          <div
            className={styles.recentScroll}
            ref={recentScrollRef}
            onScroll={updateRecentScrollState}
          >
            {recentRecipes.map(recipe => {
              const isFavorite = favoriteRecipeIds.has(recipe.id);
              return (
                <div
                  key={recipe.id}
                  className={styles.recentCardItem}
                  onClick={() => goToRecipeDetail(recipe.id)}
                >
                  <div className={styles.recentImageWrap}>
                    <img src={recipe.imageUrl} alt={recipe.name} className={styles.recentImage} />
                    <span
                      className={`${styles.recentDifficulty} ${
                        styles[difficultyStyles[recipe.difficulty]]
                      }`}
                    >
                      {difficultyLabels[recipe.difficulty]}
                    </span>
                    <button
                      type="button"
                      className={`${styles.recentFavoriteBtn} ${
                        isFavorite ? styles.recentFavoriteBtnActive : ""
                      }`}
                      aria-label="즐겨찾기"
                      onClick={event => toggleRecentFavorite(recipe.id, event)}
                    >
                      <i className={isFavorite ? "fa-solid fa-heart" : "fa-regular fa-heart"} />
                    </button>
                  </div>
                  <div className={styles.recentInfo}>
                    <p className={styles.recentName}>{recipe.name}</p>
                    <div className={styles.recentMeta}>
                      <span className={styles.recentMetaItem}>
                        <span className="material-icons" aria-hidden="true">
                          timer
                        </span>
                        {recipe.time}분
                      </span>
                      <span className={styles.recentMetaItem}>
                        <span className="material-icons" aria-hidden="true">
                          person
                        </span>
                        {recipe.servings}인분
                      </span>
                      <span className={`${styles.recentMetaItem} ${styles.recentMetaItemLikes}`}>
                        <span className="material-icons" aria-hidden="true">
                          favorite
                        </span>
                        {recipe.likes}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        )}
      </div>
    </div>
  );
}

export default MyPage;
