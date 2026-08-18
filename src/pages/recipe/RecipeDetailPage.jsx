import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import Badge from "../../components/common/Badge";
import NotFoundPage from "../notfound/NotFoundPage";
import { supabase } from "../../lib/supabase";
import styles from "./RecipeDetailPage.module.css";
import "material-icons/iconfont/filled.css";
import { recordRecipeView } from "../../services/recentViewService";
import { generateCustomRecipe, getCachedCustomRecipe } from "../../services/aiRecipeService";
import {
  addFavorite,
  getFavoriteCounts,
  getFavoriteRecipeIds,
  removeFavorite,
} from "../../services/favoriteService";

const VEGAN_TYPE_ORDER = [
  "general",
  "flexitarian",
  "pollo",
  "pesco",
  "lacto_ovo",
  "lacto",
  "ovo",
  "vegan",
];

const INGREDIENT_CHECK_CATEGORY_IDS = new Set(["condiments", "kimchi", "meat", "seasoning"]);
const RECIPE_NOT_FOUND_ERROR = "recipe-not-found";

// 데이터 정렬 및 판별

// 비건 유형 목록 화면 표시할 지정 순서대로 정렬
function sortVeganTypes(veganTypes) {
  const orderById = new Map(VEGAN_TYPE_ORDER.map((id, index) => [id, index]));

  return [...veganTypes].sort(
    (a, b) =>
      (orderById.get(a.id) ?? VEGAN_TYPE_ORDER.length) -
      (orderById.get(b.id) ?? VEGAN_TYPE_ORDER.length),
  );
}

// 조건에 맞는 CSS 모듈 클래스 이름 정리
function cn(...classNames) {
  return classNames
    .filter(Boolean)
    .flatMap(className => className.split(" "))
    .filter(Boolean)
    .map(className => styles[className] ?? className)
    .join(" ");
}

// AI 맞춤 레시피 생성 단계
const analysisSteps = [
  "내 알레르기 정보를 확인하고 있어요",
  "비건 기준을 적용하고 있어요",
  "안전한 재료를 찾고 있어요",
  "조리 순서를 다시 만들고 있어요",
];

// AI 질문 예시
const suggestedQuestions = [
  "글루텐 프리도 가능한가요?",
  "대체재 없이 만들 수 있나요?",
  "다른 채소로 바꿔도 될까요?",
  "보관 방법이 궁금해요",
];

// 재료 카테고리와 사용자의 알레르기 조건을 비교해 일치하는 알레르기명 탐색
function findMatchedAllergy(ingredient, allergenIds, categoryMappings, allergyOptions) {
  const matchedMapping = categoryMappings.find(
    mapping =>
      allergenIds.some(allergenId => String(allergenId) === String(mapping.allergen_id)) &&
      String(mapping.category_id ?? mapping.food_category_id) === String(ingredient.categoryId),
  );

  if (!matchedMapping) return undefined;
  return allergyOptions.find(allergy => String(allergy.id) === String(matchedMapping.allergen_id))
    ?.name;
}

// 재료가 선택한 비건 유형에서 제한되는 카테고리인지 확인
function isRestrictedForVeganType(ingredient, veganTypeId, veganTypeRestrictions) {
  if (veganTypeId == null || veganTypeId === "") return false;

  return veganTypeRestrictions.some(
    restriction =>
      String(restriction.vegan_type_id) === String(veganTypeId) &&
      String(restriction.category_id ?? restriction.food_category_id) ===
        String(ingredient.categoryId),
  );
}

// 화면 구성 컴포넌트

// 이름과 크기에 맞는 Material 아이콘 렌더링
function Icon({ name, size = 18 }) {
  const materialIconNames = {
    user: "person",
    clock: "schedule",
    heart: "favorite",
    alert: "warning_amber",
    check: "check",
    book: "menu_book",
    shield: "verified_user",
    chat: "chat_bubble_outline",
    info: "info",
    send: "send",
  };

  return (
    <span
      className={`material-symbols-outlined ${cn("recipe-icon")}`}
      style={{ fontSize: `${size}px` }}
      aria-hidden="true"
    >
      {materialIconNames[name]}
    </span>
  );
}

// 현재 적용된 알레르기 및 비건 조건과 조건 수정 버튼 표시
function Condition({ allergies, veganType, onOpenConditions }) {
  return (
    <>
      <div className={cn("condition-bar")}>
        <div className={cn("condition-bar__inner")}>
          <div>
            <strong className="text-button-xs">현재 적용 조건 :</strong>
            {allergies.map(allergy => (
              <span
                className={cn("condition-tag condition-tag--warning text-button-xs")}
                key={allergy}
              >
                <Icon name="alert" size={13} />
                {allergy} 제외
              </span>
            ))}
            {veganType && (
              <span className={cn("condition-tag text-button-xs")}>
                <Icon name="check" size={13} />
                {veganType}
              </span>
            )}
          </div>
          <button className="text-xs" type="button" onClick={onOpenConditions}>
            조건 수정
          </button>
        </div>
      </div>
    </>
  );
}

// 원본 또는 대체 레시피의 재료 목록과 주의 정보 표시
function IngredientPanel({ ingredients }) {
  return (
    <aside className={cn("ingredient-card")}>
      <h2>
        <Icon name="book" size={16} /> 재료
      </h2>
      <ul>
        {ingredients.map(ingredient => (
          <li key={ingredient.id ?? ingredient.name} className={cn("ingredient")}>
            <div
              className={cn(
                "ingredient__row",
                ingredient.warning ? "ingredient--warning" : "",
                ingredient.needReplacement && !ingredient.warning
                  ? "ingredient--replacement-needed"
                  : "",
              )}
            >
              <div>
                {ingredient.original && (
                  <del className="text-xs">
                    {ingredient.original.name} <small>{ingredient.original.amount}</small>
                  </del>
                )}
                <strong className="text-button-m">{ingredient.name}</strong>
                <span className="text-s">{ingredient.amount}</span>
              </div>
              <Badge
                type={
                  ingredient.warning
                    ? "danger"
                    : ingredient.needReplacement
                      ? "needReplacement"
                      : ingredient.replacement
                        ? "replacement"
                        : "safe"
                }
              />
            </div>
            {ingredient.warning && (
              <p className="text-button-xs">
                <Icon name="alert" size={12} />
                {ingredient.warning}
                {ingredient.needReplacement ? ` + ${ingredient.needReplacement}` : ""}
              </p>
            )}
            {ingredient.needReplacement && !ingredient.warning && (
              <p className={cn("need-replacement-copy text-button-xs")}>
                <Icon name="alert" size={12} />
                {ingredient.needReplacement}
              </p>
            )}
            {ingredient.replacement && (
              <p className={cn("replacement-copy text-button-xs")}>↻ {ingredient.replacement}</p>
            )}
          </li>
        ))}
      </ul>
      <div className={cn("ingredient-note")}>
        <Icon name="alert" size={15} />
        <p className="text-xs">
          <strong className="text-button-xs">실제 제품의 성분표를 반드시 확인하세요.</strong>
          <br />
          제품마다 숨겨진 성분이 다를 수 있습니다.
        </p>
      </div>
    </aside>
  );
}

// AI 맞춤 레시피 생성 단계와 결과 상태에 맞는 안내 화면 표시
function AnalysisPanel({
  analysisState,
  progress,
  errorMessage,
  replacementCount,
  mismatchedIngredients,
  onStart,
  onCompare,
  onMoreInfo,
  requiresLogin,
  onLogin,
}) {
  if (analysisState === "analyzing") {
    const completedCount = Math.min(Math.floor(progress / 25), analysisSteps.length);
    return (
      <section className={cn("analysis-card")} aria-live="polite">
        <h2>
          <Icon name="shield" size={25} />
          AI 성분 스크리닝 중
        </h2>
        <ul>
          {analysisSteps.map((step, index) => (
            <li
              key={step}
              className={cn(
                index < completedCount
                  ? "is-complete"
                  : index === completedCount
                    ? "is-current"
                    : "",
              )}
            >
              <span className="text-xs">
                {index < completedCount ? (
                  <Icon name="check" size={11} />
                ) : index === completedCount ? (
                  "◆"
                ) : (
                  ""
                )}
              </span>
              {step}
            </li>
          ))}
        </ul>
        <div className={cn("analysis-progress")}>
          <div style={{ width: `${progress}%` }} />
        </div>
        <strong className={cn("analysis-percent")}>{progress}%</strong>
      </section>
    );
  }

  if (analysisState === "complete") {
    return (
      <section className={cn("complete-card")}>
        <div className={cn("complete-card__title")}>
          <Icon name="shield" size={25} />
          <div>
            <h2>내 조건에 맞게 안전하게 변경되었어요</h2>
            <p className="text-xs">
              {replacementCount}개의 재료가 대체되었으며 조리 과정도 함께 안내드려요.
            </p>
          </div>
        </div>
        <div className={cn("complete-card__actions")}>
          <button
            className={cn("primary-button primary-button--soft text-button-s")}
            type="button"
            onClick={onCompare}
          >
            <Icon name="shield" size={15} />
            기존 레시피와 비교하기
          </button>
          <button
            className={cn("secondary-button text-button-s")}
            type="button"
            onClick={onMoreInfo}
          >
            <Icon name="info" size={14} />더 알아보기
          </button>
        </div>
      </section>
    );
  }

  if (analysisState === "error") {
    return (
      <section className={cn("mismatch-card")} role="alert">
        <div className={cn("mismatch-card__title")}>
          <span className={cn("mismatch-card__warning-icon")}>
            <Icon name="alert" size={25} />
          </span>
          <div>
            <h2>AI 맞춤 레시피를 만들지 못했어요</h2>
            <p className="text-xs">{errorMessage}</p>
          </div>
        </div>
        <div
          className={cn(
            "mismatch-card__actions",
            requiresLogin ? "mismatch-card__actions--single" : "",
          )}
        >
          <button
            className={cn("primary-button text-button-s")}
            type="button"
            onClick={requiresLogin ? onLogin : onStart}
          >
            {requiresLogin ? "로그인 페이지로 이동" : "다시 시도"}
          </button>
        </div>
      </section>
    );
  }

  if (mismatchedIngredients.length === 0) {
    return (
      <section className={cn("complete-card")}>
        <div className={cn("complete-card__title")}>
          <Icon name="shield" size={25} />
          <div>
            <h2>현재 조건에서 안전한 레시피예요</h2>
            <p className="text-xs">알레르기·비건 조건과 맞지 않는 재료가 발견되지 않았어요.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("mismatch-card")}>
      <div className={cn("mismatch-card__title")}>
        <span className={cn("mismatch-card__warning-icon")}>
          <Icon name="alert" size={25} />
        </span>
        <div>
          <h2>{mismatchedIngredients.length}개 재료가 내 조건과 맞지 않아요</h2>
          <p className="text-xs">알레르기·비건 조건에 주의가 필요한 재료가 있어요.</p>
        </div>
      </div>
      {mismatchedIngredients.map(ingredient => (
        <div className={cn("mismatch-card__notices")} key={ingredient.id ?? ingredient.name}>
          {ingredient.warning && (
            <span className={cn("danger-chip text-button-xs")}>
              <Icon name="alert" size={12} />
              {ingredient.name} - {ingredient.warning}
              {ingredient.needReplacement ? ` + ${ingredient.needReplacement}` : ""}
            </span>
          )}
          {ingredient.needReplacement && !ingredient.warning && (
            <span className={cn("warning-chip text-button-xs")}>
              <Icon name="alert" size={12} />
              {ingredient.name} - {ingredient.needReplacement}
            </span>
          )}
        </div>
      ))}
      <div className={cn("mismatch-card__actions")}>
        <button className={cn("primary-button text-button-s")} type="button" onClick={onStart}>
          <Icon name="shield" size={15} />
          AI 맞춤 레시피 만들기
        </button>
        <button className={cn("secondary-button text-button-s")} type="button" onClick={onMoreInfo}>
          <Icon name="info" size={14} />더 알아보기
        </button>
      </div>
    </section>
  );
}

// 레시피 정보를 불러오는 동안 표시할 스켈레톤 화면 렌더링
function RecipeDetailSkeleton() {
  return (
    <div className={cn("recipe-page skeleton-page")} aria-busy="true" aria-live="polite">
      <span className={cn("hidden")}>레시피를 불러오는 중입니다.</span>
      <div className={cn("skeleton-condition")} aria-hidden="true">
        <span className={cn("skeleton-block skeleton-condition__title")} />
        <span className={cn("skeleton-block skeleton-condition__tag")} />
        <span className={cn("skeleton-block skeleton-condition__tag")} />
      </div>
      <main className={cn("skeleton-detail")} aria-hidden="true">
        <div className={cn("skeleton-grid")}>
          <div className={cn("skeleton-main")}>
            <div className={cn("skeleton-block skeleton-photo")} />
            <section className={cn("skeleton-card skeleton-analysis")}>
              <span className={cn("skeleton-block skeleton-line skeleton-line--medium")} />
              <span className={cn("skeleton-block skeleton-line")} />
              <span className={cn("skeleton-block skeleton-button")} />
            </section>
            <section className={cn("skeleton-card skeleton-steps")}>
              <span className={cn("skeleton-block skeleton-line skeleton-line--short")} />
              {[1, 2, 3, 4].map(step => (
                <div className={cn("skeleton-step")} key={step}>
                  <span className={cn("skeleton-block skeleton-step__number")} />
                  <span className={cn("skeleton-block skeleton-line")} />
                </div>
              ))}
            </section>
          </div>
          <div className={cn("skeleton-side")}>
            <section className={cn("skeleton-card skeleton-summary")}>
              <span className={cn("skeleton-block skeleton-line skeleton-line--title")} />
              <span className={cn("skeleton-block skeleton-line")} />
              <span className={cn("skeleton-block skeleton-line skeleton-line--medium")} />
              <div className={cn("skeleton-meta")}>
                <span className={cn("skeleton-block")} />
                <span className={cn("skeleton-block")} />
                <span className={cn("skeleton-block")} />
              </div>
            </section>
            <section className={cn("skeleton-card skeleton-ingredients")}>
              <span className={cn("skeleton-block skeleton-line skeleton-line--short")} />
              {[1, 2, 3, 4, 5].map(item => (
                <span className={cn("skeleton-block skeleton-line")} key={item} />
              ))}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

// 레시피 상세 페이지

// 레시피 조회, 조건 분석, 즐겨찾기 및 AI 기능을 관리
function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [isRecipeLoading, setIsRecipeLoading] = useState(true);
  const [recipeError, setRecipeError] = useState("");
  const [analysisState, setAnalysisState] = useState("before");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisRequiresLogin, setAnalysisRequiresLogin] = useState(false);
  const [aiCustomRecipe, setAiCustomRecipe] = useState(null);
  const [isSimpleRecipeOpen, setIsSimpleRecipeOpen] = useState(false);
  const [simpleRecipeStep, setSimpleRecipeStep] = useState(0);
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [isMoreInfoOpen, setIsMoreInfoOpen] = useState(false);
  const [appliedAllergies, setAppliedAllergies] = useState([]);
  const [appliedAllergenIds, setAppliedAllergenIds] = useState([]);
  const [appliedVeganType, setAppliedVeganType] = useState("");
  const [appliedVeganTypeId, setAppliedVeganTypeId] = useState(null);
  const [draftAllergies, setDraftAllergies] = useState([]);
  const [draftVeganType, setDraftVeganType] = useState("");
  const [allergyOptions, setAllergyOptions] = useState([]);
  const [allergenCategoryMappings, setAllergenCategoryMappings] = useState([]);
  const [veganOptions, setVeganOptions] = useState([]);
  const [veganTypeRestrictions, setVeganTypeRestrictions] = useState([]);
  const [conditionOptionsError, setConditionOptionsError] = useState("");
  const [isConditionDataLoading, setIsConditionDataLoading] = useState(true);
  const [isUserConditionsLoading, setIsUserConditionsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFavoriteUpdating, setIsFavoriteUpdating] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [recipeQuestion, setRecipeQuestion] = useState("");
  const [questionMessages, setQuestionMessages] = useState([]);
  const [isQuestionLoading, setIsQuestionLoading] = useState(false);
  const isComplete = analysisState === "complete";
  const ingredients = (recipe?.recipe_ingredients ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(item => {
      const ingredient = {
        id: item.ingredients.id,
        name: item.ingredients.name,
        amount: item.amount,
        categoryId: item.ingredients.category_id,
      };
      const matchedAllergy = findMatchedAllergy(
        ingredient,
        appliedAllergenIds,
        allergenCategoryMappings,
        allergyOptions,
      );
      const veganRestricted = isRestrictedForVeganType(
        ingredient,
        appliedVeganTypeId,
        veganTypeRestrictions,
      );

      return {
        ...ingredient,
        warning: matchedAllergy ? `${matchedAllergy} 알레르기 위험` : undefined,
        needReplacement: veganRestricted ? `${appliedVeganType} 부적합` : undefined,
      };
    });
  const mismatchedIngredients = ingredients.filter(
    ingredient => ingredient.warning || ingredient.needReplacement,
  );
  const steps = (recipe?.recipe_steps ?? [])
    .filter(step => step.step_type === "detail")
    .sort((a, b) => a.step_number - b.step_number)
    .map(step => step.description);
  const briefSteps = (recipe?.recipe_steps ?? [])
    .filter(step => step.step_type === "brief")
    .sort((a, b) => a.step_number - b.step_number)
    .map(step => step.description);
  const aiIngredients = (aiCustomRecipe?.ingredients ?? []).map(item => {
    const original = item.replacement
      ? ingredients.find(ingredient => ingredient.id === item.replacement.originalIngredientId)
      : null;

    return {
      id: item.ingredientId,
      name: item.name,
      amount: item.amount,
      categoryId: item.categoryId,
      original: original ?? undefined,
      replacement: item.replacement?.reason,
    };
  });
  const displayedIngredients = isComplete && aiCustomRecipe ? aiIngredients : ingredients;
  const ingredientsRequiringLabelCheck =
    isComplete && aiCustomRecipe
      ? displayedIngredients.filter(ingredient =>
          INGREDIENT_CHECK_CATEGORY_IDS.has(ingredient.categoryId),
        )
      : [];
  const aiDetailSteps = (aiCustomRecipe?.steps?.detail ?? []).map(step => step.description);
  const aiBriefSteps = (aiCustomRecipe?.steps?.brief ?? []).map(step => step.description);
  const displayedSteps = isComplete && aiCustomRecipe ? aiDetailSteps : steps;
  const simpleModalSteps =
    isComplete && aiCustomRecipe
      ? aiBriefSteps.length > 0
        ? aiBriefSteps
        : aiDetailSteps
      : briefSteps.length > 0
        ? briefSteps
        : steps;
  const displayedRecipe =
    isComplete && aiCustomRecipe
      ? {
          ...recipe,
          title: aiCustomRecipe.title,
          description: aiCustomRecipe.description,
          servings: aiCustomRecipe.servings,
          cooking_time: aiCustomRecipe.cookingTime,
        }
      : recipe;

  // 레시피 및 즐겨찾기 데이터 불러오기

  // 레시피 상세 정보를 불러오고 로그인 사용자의 최근 본 레시피 기록
  useEffect(() => {
    let isActive = true;

    // 로그인 사용자의 레시피 조회 기록 저장
    async function recordLoadedRecipeView(recipeId) {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("[HankkiLab] Session check error:", sessionError);
        return;
      }
      if (!session?.user) return;

      try {
        await recordRecipeView(session.user.id, recipeId);
      } catch (error) {
        console.error("[HankkiLab] Recent recipe view error:", error);
      }
    }

    // URL의 레시피 ID로 상세 데이터와 조리 단계 조회
    async function loadRecipe() {
      if (!id) {
        setRecipeError(RECIPE_NOT_FOUND_ERROR);
        setIsRecipeLoading(false);
        return;
      }

      setIsRecipeLoading(true);
      setRecipe(null);
      setRecipeError("");
      try {
        const { data, error } = await supabase
          .from("recipes")
          .select(
            `
          id,
          title,
          description,
          image_url,
          servings,
          cooking_time,
          difficulty,
          recipe_ingredients (
            amount,
            sort_order,
            ingredients (
              id,
              name,
              category_id
            )
          ),
          recipe_steps (
            step_number,
            description,
            step_type
          )
        `,
          )
          .eq("id", id)
          .maybeSingle();

        if (!isActive) return;
        if (error) {
          console.error("[HankkiLab] Recipe detail error:", error);
          setRecipeError(
            error.code === "22P02" ? RECIPE_NOT_FOUND_ERROR : "레시피를 불러오지 못했습니다.",
          );
        } else if (!data) {
          setRecipeError(RECIPE_NOT_FOUND_ERROR);
        } else {
          setRecipe(data);
          setAnalysisState("before");
          setAnalysisProgress(0);
          setAnalysisError("");
          setAiCustomRecipe(null);
          setSimpleRecipeStep(0);
          setRecipeQuestion("");
          setQuestionMessages([]);
          void recordLoadedRecipeView(data.id);
        }
      } catch (error) {
        if (!isActive) return;
        console.error("[HankkiLab] Recipe detail request failed:", error);
        setRecipeError(
          error?.code === "22P02" ? RECIPE_NOT_FOUND_ERROR : "레시피를 불러오지 못했습니다.",
        );
      } finally {
        if (isActive) setIsRecipeLoading(false);
      }
    }

    loadRecipe();
    return () => {
      isActive = false;
    };
  }, [id]);

  // 해당 레시피 즐겨찾기 된 횟수 불러오기
  useEffect(() => {
    let isActive = true;

    // 현재 레시피 ID에 해당하는 즐겨찾기 개수 조회
    async function loadFavoriteCount() {
      if (!id) return;

      try {
        const counts = await getFavoriteCounts([id]);
        if (isActive) {
          setFavoriteCount(Number(counts[id] ?? 0));
        }
      } catch (error) {
        console.error("[HankkiLab] Favorite count load error:", error);
      }
    }

    void loadFavoriteCount();

    return () => {
      isActive = false;
    };
  }, [id]);

  // 로그인 사용자의 현재 레시피를 즐겨찾기 여부 확인
  useEffect(() => {
    let isActive = true;

    // 사용자 즐겨찾기 목록에서 현재 레시피의 저장 여부 확인
    async function loadFavoriteState() {
      setIsFavorite(false);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isActive) return;
      if (sessionError) {
        console.error("[HankkiLab] Favorite session check error:", sessionError);
        return;
      }
      if (!session?.user || !id) return;

      try {
        const favoriteRecipeIds = await getFavoriteRecipeIds(session.user.id);
        if (isActive) {
          setIsFavorite(favoriteRecipeIds.some(recipeId => String(recipeId) === String(id)));
        }
      } catch (error) {
        console.error("[HankkiLab] Favorite state load error:", error);
      }
    }

    void loadFavoriteState();

    return () => {
      isActive = false;
    };
  }, [id]);

  // 알레르기 및 비건 조건 데이터 불러오기

  // 조건 수정에 필요한 알레르기, 비건 유형 및 카테고리 매핑 불러오기
  useEffect(() => {
    let isActive = true;

    // Supabase에서 맞춤 조건 선택지와 제한 기준 데이터 함께 조회.
    async function loadConditionOptions() {
      setIsConditionDataLoading(true);
      try {
        const [allergensResult, veganTypesResult, mappingsResult, restrictionsResult] =
          await Promise.all([
            supabase.from("allergens").select("id, name").order("name"),
            supabase.from("vegan_types").select("id, name, description"),
            supabase.from("allergen_category_mappings").select("*"),
            supabase.from("vegan_type_restrictions").select("*"),
          ]);

        if (!isActive) return;
        const error =
          allergensResult.error ??
          veganTypesResult.error ??
          mappingsResult.error ??
          restrictionsResult.error;
        if (error) {
          console.error("[HankkiLab] Condition options error:", error);
          setConditionOptionsError("조건 목록을 불러오지 못했습니다.");
          setIsConditionDataLoading(false);
          return;
        }

        setAllergyOptions(allergensResult.data ?? []);
        setVeganOptions(sortVeganTypes(veganTypesResult.data ?? []));
        setAllergenCategoryMappings(mappingsResult.data ?? []);
        setVeganTypeRestrictions(restrictionsResult.data ?? []);
        setConditionOptionsError("");
        setIsConditionDataLoading(false);
      } catch (error) {
        if (!isActive) return;
        console.error("[HankkiLab] Condition options request failed:", error);
        setConditionOptionsError("조건 목록을 불러오지 못했습니다.");
        setIsConditionDataLoading(false);
      }
    }

    loadConditionOptions();
    return () => {
      isActive = false;
    };
  }, []);

  // 로그인 사용자의 현재 알레르기 및 비건 설정 불러오기
  useEffect(() => {
    let isActive = true;

    // 사용자 프로필과 알레르기 설정을 조회해 적용 조건 초기화
    async function loadUserConditions() {
      setIsUserConditionsLoading(true);
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!isActive) return;
        if (sessionError) {
          console.error("[HankkiLab] User condition session error:", sessionError);
          setIsUserConditionsLoading(false);
          return;
        }

        if (!session?.user) {
          setAppliedAllergies([]);
          setAppliedAllergenIds([]);
          setAppliedVeganType("");
          setAppliedVeganTypeId(null);
          setDraftAllergies([]);
          setDraftVeganType("");
          setIsUserConditionsLoading(false);
          return;
        }

        const [profileResult, allergyResult] = await Promise.all([
          supabase.from("profiles").select("vegan_type_id").eq("id", session.user.id).maybeSingle(),
          supabase
            .from("user_allergies")
            .select("allergen_id, allergens(name)")
            .eq("user_id", session.user.id),
        ]);

        if (!isActive) return;
        if (profileResult.error || allergyResult.error) {
          console.error("[HankkiLab] User conditions error:", {
            profileError: profileResult.error,
            allergyError: allergyResult.error,
          });
          setIsUserConditionsLoading(false);
          return;
        }

        const allergies = (allergyResult.data ?? [])
          .map(item => {
            const allergen = Array.isArray(item.allergens) ? item.allergens[0] : item.allergens;
            return allergen?.name;
          })
          .filter(name => typeof name === "string");
        const allergenIds = (allergyResult.data ?? []).map(item => item.allergen_id);

        let veganType = "";
        if (profileResult.data?.vegan_type_id != null) {
          const { data: veganTypeData, error: veganTypeError } = await supabase
            .from("vegan_types")
            .select("name")
            .eq("id", profileResult.data.vegan_type_id)
            .maybeSingle();

          if (!isActive) return;
          if (veganTypeError) {
            console.error("[HankkiLab] User vegan type error:", veganTypeError);
          } else {
            veganType = veganTypeData?.name ?? "";
          }
        }

        setAppliedAllergies(allergies);
        setAppliedAllergenIds(allergenIds);
        setAppliedVeganType(veganType);
        setAppliedVeganTypeId(profileResult.data?.vegan_type_id ?? null);
        setDraftAllergies(allergies);
        setDraftVeganType(veganType);
        setIsUserConditionsLoading(false);
      } catch (error) {
        if (!isActive) return;
        console.error("[HankkiLab] User conditions request failed:", error);
        setIsUserConditionsLoading(false);
      }
    }

    loadUserConditions();
    return () => {
      isActive = false;
    };
  }, []);

  // AI 맞춤 레시피 상태 관리

  // 이전에 생성해 둔 맞춤 레시피가 있다면 캐시에서 불러오기
  useEffect(() => {
    if (isRecipeLoading || isUserConditionsLoading || recipe?.id !== id) return undefined;

    let isActive = true;

    // 현재 레시피와 사용자 조건에 대응하는 캐시 결과 조회
    async function loadCachedCustomRecipe() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session || !isActive) return;

        const result = await getCachedCustomRecipe(id, {
          allergenIds: appliedAllergenIds,
          veganTypeId: appliedVeganTypeId,
        });
        if (!isActive || !result?.customRecipe) return;

        setAiCustomRecipe(result.customRecipe);
        setAnalysisError("");
        setAnalysisProgress(100);
        setAnalysisState("complete");
      } catch (error) {
        if (isActive) {
          console.warn("[HankkiLab] Cached custom recipe load failed:", error);
        }
      }
    }

    void loadCachedCustomRecipe();
    return () => {
      isActive = false;
    };
  }, [
    id,
    isRecipeLoading,
    isUserConditionsLoading,
    recipe?.id,
    appliedAllergenIds,
    appliedVeganTypeId,
  ]);

  // AI 분석 중 진행률이 자연스럽게 증가하도록 타이머 실행
  useEffect(() => {
    if (analysisState !== "analyzing") return undefined;
    const timer = window.setInterval(() => {
      setAnalysisProgress(currentProgress => Math.min(currentProgress + 5, 90));
    }, 280);
    return () => window.clearInterval(timer);
  }, [analysisState]);

  // ===== 모달 공통 동작 관리 =====

  // 간단 레시피 모달이 열리면 배경 스크롤과 Escape 닫기 제어
  useEffect(() => {
    if (!isSimpleRecipeOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Escape 키 입력 시 간단 레시피 모달 닫기
    const handleKeyDown = event => {
      if (event.key === "Escape") setIsSimpleRecipeOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSimpleRecipeOpen]);

  // 조건 수정 모달이 열리면 배경 스크롤과 Escape 닫기 제어
  useEffect(() => {
    if (!isConditionModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Escape 키 입력 시 조건 수정 모달 닫기
    const handleKeyDown = event => {
      if (event.key === "Escape") setIsConditionModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConditionModalOpen]);

  // 더 알아보기 모달이 열리면 배경 스크롤, Escape 닫기 제어
  useEffect(() => {
    if (!isMoreInfoOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Escape 키 입력 시 더 알아보기 모달 닫기
    const handleKeyDown = event => {
      if (event.key === "Escape") setIsMoreInfoOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreInfoOpen]);

  // AI 맞춤 레시피 및 즐겨찾기 동작

  // 로그인 여부를 확인한 뒤 AI 맞춤 레시피 생성 시작
  const startAnalysis = async () => {
    if (analysisState === "analyzing") return;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[HankkiLab] AI recipe session check error:", sessionError);
    }

    if (!session?.user) {
      setAnalysisProgress(0);
      setAnalysisError("AI 맞춤 레시피 기능을 사용할 수 없습니다. 로그인 후 이용해 주세요.");
      setAnalysisRequiresLogin(true);
      setAnalysisState("error");
      return;
    }

    if (aiCustomRecipe) {
      setAnalysisProgress(100);
      setAnalysisState("complete");
      return;
    }

    setAnalysisProgress(0);
    setAnalysisError("");
    setAnalysisRequiresLogin(false);
    setAnalysisState("analyzing");

    try {
      const result = await generateCustomRecipe(id, {
        allergenIds: appliedAllergenIds,
        veganTypeId: appliedVeganTypeId,
      });

      if (result?.status === "replacement_not_required") {
        setAnalysisProgress(0);
        setAnalysisState("before");
        return;
      }

      if (!result?.customRecipe) {
        throw new Error("AI 맞춤 레시피 응답이 올바르지 않습니다.");
      }

      setAiCustomRecipe(result.customRecipe);
      setAnalysisProgress(100);
      setAnalysisState("complete");
    } catch (error) {
      console.error("[HankkiLab] Custom recipe generation error:", error);
      setAnalysisError(
        error instanceof Error ? error.message : "AI 맞춤 레시피를 만들지 못했습니다.",
      );
      setAnalysisRequiresLogin(false);
      setAnalysisProgress(0);
      setAnalysisState("error");
    }
  };

  // AI 맞춤 결과에서 원본 레시피 화면 되돌리기
  const showOriginalRecipe = () => {
    setAnalysisProgress(0);
    setAnalysisState("before");
  };

  // 로그인 사용자의 현재 레시피 즐겨찾기 상태를 추가, 해제
  const toggleFavorite = async () => {
    if (!recipe?.id || isFavoriteUpdating) return;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[HankkiLab] Favorite session check error:", sessionError);
    }

    if (!session?.user) {
      alert("로그인 후 즐겨찾기 기능을 이용해 주세요.");
      return;
    }

    setIsFavoriteUpdating(true);

    try {
      const wasFavorite = isFavorite;

      if (isFavorite) {
        await removeFavorite(session.user.id, recipe.id);
      } else {
        await addFavorite(session.user.id, recipe.id);
      }

      setIsFavorite(!wasFavorite);
      setFavoriteCount(current => Math.max(0, current + (wasFavorite ? -1 : 1)));
    } catch (error) {
      console.error("[HankkiLab] Favorite update error:", error);
      alert("즐겨찾기 상태를 변경하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsFavoriteUpdating(false);
    }
  };

  // 모달 및 조건 수정 동작

  // 간단 레시피를 첫 단계부터 보여 주는 모달 열기
  const openSimpleRecipe = () => {
    setSimpleRecipeStep(0);
    setIsSimpleRecipeOpen(true);
  };

  // 간단 레시피 모달을 닫습니다.
  const closeSimpleRecipe = () => setIsSimpleRecipeOpen(false);

  // 현재 적용 조건을 임시 선택값에 복사한 뒤 조건 수정 모달 열기
  const openConditionModal = () => {
    setDraftAllergies([...appliedAllergies]);
    setDraftVeganType(appliedVeganType);
    setIsConditionModalOpen(true);
  };

  // 변경 내용 취소하고 조건 수정 모달 닫기
  const closeConditionModal = () => {
    setDraftAllergies([...appliedAllergies]);
    setDraftVeganType(appliedVeganType);
    setIsConditionModalOpen(false);
  };

  // 선택한 알레르기 항목 임시 조건 목록에 추가, 제거
  const toggleAllergy = allergy => {
    setDraftAllergies(current =>
      current.includes(allergy) ? current.filter(item => item !== allergy) : [...current, allergy],
    );
  };

  // 임시 알레르기 및 비건 조건 적용, AI 분석 결과 초기화
  const applyConditions = () => {
    setAppliedAllergies([...draftAllergies]);
    setAppliedAllergenIds(
      allergyOptions
        .filter(allergy => draftAllergies.includes(allergy.name))
        .map(allergy => allergy.id),
    );
    setAppliedVeganType(draftVeganType);
    setAppliedVeganTypeId(
      veganOptions.find(veganType => veganType.name === draftVeganType)?.id ?? null,
    );
    setAiCustomRecipe(null);
    setAnalysisError("");
    setAnalysisProgress(0);
    setAnalysisState("before");
    setIsConditionModalOpen(false);
  };

  // AI 레시피 질문 동작

  // 입력한 질문과 이전 대화 내용 Edge Function에 전달하고 답변 표시
  const askRecipeQuestion = async event => {
    event.preventDefault();
    const question = recipeQuestion.trim();

    if (!question || isQuestionLoading) return;

    const previousConversation = questionMessages
      .filter(message => message.status !== "error")
      .map(({ role, content }) => ({ role, content }));
    setQuestionMessages(current => [...current, { role: "user", content: question }]);
    setRecipeQuestion("");
    setIsQuestionLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setQuestionMessages(current => [
          ...current,
          {
            role: "assistant",
            content: "로그인 후 AI 질문 기능을 이용해 주세요.",
            status: "error",
          },
        ]);
        return;
      }

      const { data, error } = await supabase.functions.invoke("answer-recipe-question", {
        body: {
          recipeId: recipe.id,
          question,
          conversation: previousConversation,
        },
      });

      if (error) {
        console.error("[HankkiLab] Recipe question error:", error);
        setQuestionMessages(current => [
          ...current,
          {
            role: "assistant",
            content: "답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
            status: "error",
          },
        ]);
      } else if (!data?.answer) {
        setQuestionMessages(current => [
          ...current,
          {
            role: "assistant",
            content: "AI가 답변을 생성하지 못했어요. 질문을 바꿔 다시 시도해 주세요.",
            status: "error",
          },
        ]);
      } else {
        setQuestionMessages(current => [...current, { role: "assistant", content: data.answer }]);
      }
    } catch (error) {
      console.error("[HankkiLab] Recipe question request failed:", error);
      setQuestionMessages(current => [
        ...current,
        {
          role: "assistant",
          content: "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
          status: "error",
        },
      ]);
    } finally {
      setIsQuestionLoading(false);
    }
  };

  if (isRecipeLoading || isUserConditionsLoading || isConditionDataLoading) {
    return <RecipeDetailSkeleton />;
  }

  if (recipeError === RECIPE_NOT_FOUND_ERROR) {
    return <NotFoundPage />;
  }

  if (recipeError) {
    return <div className={cn("recipe-page p-4 text-s")}>{recipeError}</div>;
  }

  const difficultyLabel =
    {
      easy: "쉬움",
      normal: "보통",
      hard: "어려움",
    }[recipe.difficulty] ?? recipe.difficulty;
  const difficultyColorClass = {
    easy: "safe-badge--easy",
    normal: "safe-badge--normal",
    hard: "safe-badge--hard",
  }[recipe.difficulty];

  return (
    <div className={cn("recipe-page")}>
      <Condition
        allergies={appliedAllergies}
        veganType={appliedVeganType}
        onOpenConditions={openConditionModal}
      />
      <main className={cn("recipe-detail")}>
        <div className={cn("recipe-detail__grid")}>
          <div className={cn("recipe-detail__main")}>
            <div
              className={cn("recipe-photo")}
              role="img"
              aria-label={`${recipe.title} 완성 사진`}
              style={
                recipe.image_url ? { backgroundImage: `url("${recipe.image_url}")` } : undefined
              }
            />

            <AnalysisPanel
              analysisState={analysisState}
              progress={analysisProgress}
              errorMessage={analysisError}
              replacementCount={aiIngredients.filter(ingredient => ingredient.replacement).length}
              mismatchedIngredients={mismatchedIngredients}
              onStart={startAnalysis}
              onCompare={showOriginalRecipe}
              onMoreInfo={() => setIsMoreInfoOpen(true)}
              requiresLogin={analysisRequiresLogin}
              onLogin={() => navigate("/login")}
            />

            <div className={cn("safety-notice")}>
              <div className={cn("safety-notice__heading")}>
                <Icon name="alert" size={18} />
                <strong className="text-button-s">실제 제품의 성분표를 반드시 확인하세요.</strong>
              </div>
              <span className="text-xs">
                AI 추천은 참고용이며, 개인의 알레르기 반응은 다를 수 있습니다. 심각한 알레르기가
                있다면 의사와 상담하세요.
              </span>
            </div>

            <section className={cn("steps-card p-3 p-xl-4")}>
              <div className={cn("section-heading mb-3")}>
                <h2>조리 순서</h2>
                <button
                  className={cn("simple-recipe-button")}
                  type="button"
                  onClick={openSimpleRecipe}
                >
                  간단 레시피 보기
                </button>
              </div>
              <ol>
                {displayedSteps.map((step, index) => (
                  <li
                    key={step}
                    className={cn(isComplete ? "step--replaced" : "", "column-gap-3 py-3")}
                  >
                    <span>{index + 1}</span>
                    <div>
                      <p className="text-xs">{step}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className={cn("question-card")}>
              <h2>
                <Icon name="chat" size={22} />
                AI에게 질문하기
              </h2>
              <p className={cn("question-card__description text-xs")}>
                이 레시피에 대해 궁금한 점을 자유롭게 물어보세요.
              </p>
              <div className={cn("question-chips")}>
                {suggestedQuestions.map(question => (
                  <button
                    className="text-xs"
                    type="button"
                    key={question}
                    onClick={() => setRecipeQuestion(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
              <form className={cn("question-form")} onSubmit={askRecipeQuestion}>
                <label className={cn("hidden")} htmlFor="recipe-question">
                  레시피 질문
                </label>
                <input
                  className="text-xs"
                  id="recipe-question"
                  placeholder="예 : 돼지고기 대신 사용할 수 있는 재료가 있나요?"
                  value={recipeQuestion}
                  maxLength={300}
                  disabled={isQuestionLoading}
                  onChange={event => setRecipeQuestion(event.target.value)}
                />
                <button
                  type="submit"
                  aria-label="질문 보내기"
                  disabled={!recipeQuestion.trim() || isQuestionLoading}
                >
                  <Icon name="send" size={21} />
                </button>
              </form>
              {(questionMessages.length > 0 || isQuestionLoading) && (
                <div className={cn("chat-messages")} aria-live="polite">
                  {questionMessages.map((message, index) => (
                    <p
                      className={cn(
                        "chat-message text-xs",
                        message.role === "user" ? "chat-message--mine" : "",
                        message.status === "error" ? "chat-message--error" : "",
                      )}
                      key={`${message.role}-${index}-${message.content}`}
                    >
                      {message.content}
                    </p>
                  ))}
                  {isQuestionLoading && (
                    <div
                      className={cn("chat-message chat-message--loading")}
                      aria-label="AI가 답변을 작성하고 있어요"
                    >
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <div className={cn("recipe-detail__side")}>
            <section className={cn("recipe-summary")}>
              <h1>{displayedRecipe.title}</h1>
              <p className="text-s">{displayedRecipe.description}</p>
              <div className={cn("recipe-summary__meta")}>
                <span>
                  <Icon name="user" size={16} />
                  {displayedRecipe.servings}인분
                </span>
                <span>
                  <Icon name="clock" size={16} />
                  {displayedRecipe.cooking_time}분
                </span>
                <span className={cn("safe-badge", difficultyColorClass)}>{difficultyLabel}</span>
                <span className={cn("favorite-count")}>
                  <Icon name="heart" size={16} />
                  {favoriteCount}
                </span>
                <button
                  className={cn("favorite-button", isFavorite ? "favorite-button--active" : "")}
                  type="button"
                  aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                  aria-pressed={isFavorite}
                  disabled={isFavoriteUpdating}
                  onClick={toggleFavorite}
                >
                  <span
                    className="material-icons"
                    style={{
                      fontSize: "14px",
                      color: isFavorite ? "var(--white-1)" : "var(--danger)",
                    }}
                    aria-hidden="true"
                  >
                    {isFavorite ? "favorite" : "favorite_border"}
                  </span>
                </button>
              </div>
            </section>
            <section className={cn("view-mode")}>
              <p className="text-xs">레시피 보기 모드</p>
              <div>
                <button
                  className={cn("text-xs", !isComplete ? "is-active" : "")}
                  type="button"
                  onClick={showOriginalRecipe}
                >
                  <Icon name="book" size={14} />
                  기존 레시피
                </button>
                <button
                  className={cn("text-xs", isComplete ? "is-active" : "")}
                  type="button"
                  onClick={() => {
                    if (!isComplete) startAnalysis();
                  }}
                >
                  <Icon name="shield" size={14} />
                  AI 맞춤 레시피
                </button>
              </div>
            </section>
            <IngredientPanel ingredients={displayedIngredients} />
          </div>
        </div>
      </main>
      {isMoreInfoOpen && (
        <div
          className={cn("more-info-backdrop")}
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setIsMoreInfoOpen(false);
          }}
        >
          <section
            className={cn("more-info-modal")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="more-info-title"
          >
            <div className={cn("more-info-modal__header")}>
              <h2 id="more-info-title" className="text-subtitle-s">
                이 레시피,
                <br className={cn("more-info-title-break")} /> 어떻게 바꿀 수 있을까?
              </h2>
              <button
                className={cn("more-info-modal__close")}
                type="button"
                aria-label="더 알아보기 닫기"
                onClick={() => setIsMoreInfoOpen(false)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <section className={cn("more-info-section more-info-section--replacement")}>
              <h3 className="text-button-m">
                <span className="material-symbols-outlined" aria-hidden="true">
                  expand_circle_down
                </span>
                분류 기준에 맞는 대체재
              </h3>
              {isComplete && aiCustomRecipe ? (
                displayedIngredients
                  .filter(ingredient => ingredient.replacement)
                  .map(ingredient => (
                    <div className={cn("more-info-card")} key={ingredient.id}>
                      <div className={cn("more-info-replacement")}>
                        <div className={cn("more-info-original text-xs")}>
                          <del>{ingredient.original?.name}</del>
                          <del>{ingredient.original?.amount}</del>
                        </div>
                        <span
                          className={cn("more-info-status more-info-status--safe text-button-xs")}
                        >
                          <Icon name="check" size={12} />
                          대체완료
                        </span>
                        <div className={cn("more-info-new-ingredient text-button-s")}>
                          <strong>{ingredient.name}</strong>
                          <span className="text-xs">{ingredient.amount}</span>
                        </div>
                      </div>
                      <p className={cn("more-info-reason text-button-xs")}>
                        <span className="material-symbols-outlined" aria-hidden="true">
                          refresh
                        </span>
                        {ingredient.replacement}
                      </p>
                    </div>
                  ))
              ) : (
                <div className={cn("more-info-card")}>
                  <p className={cn("more-info-reason text-button-xs")}>
                    AI 맞춤 레시피를 만들면 대체 재료와 이유를 확인할 수 있습니다.
                  </p>
                </div>
              )}
            </section>

            {ingredientsRequiringLabelCheck.length > 0 && (
              <section className={cn("more-info-section more-info-section--check")}>
                <h3 className="text-button-m">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    do_not_disturb_on
                  </span>
                  성분표를 직접 확인해 주세요
                </h3>
                <div className={cn("more-info-card")}>
                  <div className={cn("more-info-check-list text-xs")}>
                    {ingredientsRequiringLabelCheck.map(ingredient => (
                      <div key={`${ingredient.id}-${ingredient.name}`}>
                        <strong>{ingredient.name}</strong>
                        <span>{ingredient.amount}</span>
                        <em>확인필요</em>
                      </div>
                    ))}
                  </div>
                  <ul className={cn("more-info-notes text-xs")}>
                    <li>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        arrow_right_alt
                      </span>
                      자세한 성분은 직접 확인해 주세요.
                    </li>
                    <li>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        arrow_right_alt
                      </span>
                      재료에 따라 알레르기, 비건 조건에 부적합할 수 있습니다.
                    </li>
                  </ul>
                </div>
              </section>
            )}
          </section>
        </div>
      )}
      {isConditionModalOpen && (
        <div
          className={cn("condition-modal-backdrop")}
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeConditionModal();
          }}
        >
          <section
            className={cn("condition-modal")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="condition-modal-title"
          >
            <div className={cn("condition-modal__header")}>
              <div>
                <h2 id="condition-modal-title">현재 조건 수정</h2>
                <p>알레르기와 비건 정보를 선택해 맞춤 레시피를 확인하세요.</p>
              </div>
              <div className={cn("condition-modal__header-actions")}>
                <button
                  className={cn("condition-modal__close")}
                  type="button"
                  aria-label="조건 수정 닫기"
                  onClick={closeConditionModal}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    close
                  </span>
                  <span className={cn("condition-modal__action-label")}>취소</span>
                </button>
                <button
                  className={cn("condition-modal__header-apply")}
                  type="button"
                  onClick={applyConditions}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    save
                  </span>
                  적용
                </button>
              </div>
            </div>

            <div className={cn("condition-modal__body")}>
              <section className={cn("condition-option-section")}>
                <div className={cn("condition-option-section__title")}>
                  <div>
                    <h3>알레르기 정보</h3>
                    <p>
                      해당하는 알레르기를 모두 선택해주세요. 레시피 검색 시 자동으로 적용됩니다.
                    </p>
                  </div>
                  <span>중복 선택 가능</span>
                </div>
                <div className={cn("condition-option-grid condition-option-grid--allergy")}>
                  {conditionOptionsError && <p>{conditionOptionsError}</p>}
                  {allergyOptions.map(allergy => {
                    const isSelected = draftAllergies.includes(allergy.name);
                    return (
                      <button
                        className={cn(
                          "condition-option-button condition-option-button--allergy",
                          isSelected ? "is-selected" : "",
                        )}
                        type="button"
                        aria-pressed={isSelected}
                        key={allergy.id}
                        onClick={() => toggleAllergy(allergy.name)}
                      >
                        {isSelected && <Icon name="check" size={14} />}
                        {allergy.name}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={cn("condition-option-section")}>
                <div className={cn("condition-option-section__title")}>
                  <div>
                    <h3>비건 유형</h3>
                    <p>
                      비건 유형은 알레르기와 별개 기준입니다. 가장 가까운 식단 유형을 선택하세요.
                    </p>
                  </div>
                  <span>단일 선택</span>
                </div>
                <div className={cn("condition-option-grid condition-option-grid--vegan")}>
                  {veganOptions.map(veganType => {
                    const isSelected = draftVeganType === veganType.name;
                    return (
                      <button
                        className={cn(
                          "condition-option-button condition-option-button--vegan",
                          isSelected ? "is-selected" : "",
                        )}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        key={veganType.id}
                        onClick={() => setDraftVeganType(veganType.name)}
                      >
                        {isSelected && <Icon name="check" size={14} />}
                        <span className={cn("condition-option-button__copy")}>
                          <strong>{veganType.name}</strong>
                          <small className="text-s">{veganType.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className={cn("condition-modal__footer")}>
              <button
                className={cn("condition-modal__reset text-button-xs")}
                type="button"
                onClick={() => {
                  setDraftAllergies([]);
                  setDraftVeganType("");
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  refresh
                </span>
                선택 초기화
              </button>
              <button
                className={cn("condition-modal__apply text-button-xs")}
                type="button"
                onClick={applyConditions}
              >
                조건 적용하기
              </button>
            </div>
          </section>
        </div>
      )}
      {isSimpleRecipeOpen && (
        <div
          className={cn("simple-recipe-backdrop")}
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeSimpleRecipe();
          }}
        >
          <section
            className={cn("simple-recipe-modal")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="simple-recipe-title"
          >
            <div
              className={cn(
                "simple-recipe-modal__header d-flex align-items-start justify-content-between pb-3",
              )}
            >
              <div>
                <h2 id="simple-recipe-title" className={cn("mb-2 text-title-m")}>
                  {displayedRecipe.title}
                </h2>
                <p className={cn("m-0")}>간단 레시피 · {simpleModalSteps.length}단계</p>
              </div>
              <button
                className={cn(
                  "simple-recipe-modal__close d-grid align-items-center justify-content-center",
                )}
                type="button"
                aria-label="간단 레시피 닫기"
                onClick={closeSimpleRecipe}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            <div className={cn("simple-recipe-modal__divider")} />
            <article
              className={cn(
                "simple-recipe-step-card d-flex flex-column justify-content-between my-3",
              )}
            >
              <strong>STEP {simpleRecipeStep + 1}</strong>
              <p className={cn("my-auto py-4")}>{simpleModalSteps[simpleRecipeStep]}</p>
            </article>
            <nav
              className={cn(
                "simple-recipe-controls d-flex align-items-center justify-content-between",
              )}
              aria-label="간단 레시피 단계 이동"
            >
              <button
                className={cn("simple-recipe-nav-button px-4 py-2 text-button-m")}
                type="button"
                disabled={simpleRecipeStep === 0}
                onClick={() => setSimpleRecipeStep(step => step - 1)}
              >
                이전
              </button>
              <strong>
                {simpleRecipeStep + 1} / {simpleModalSteps.length}
              </strong>
              <button
                className={cn("simple-recipe-nav-button px-4 py-2 text-button-m")}
                type="button"
                disabled={simpleRecipeStep === simpleModalSteps.length - 1}
                onClick={() => setSimpleRecipeStep(step => step + 1)}
              >
                다음
              </button>
            </nav>
          </section>
        </div>
      )}
    </div>
  );
}

export default RecipeDetailPage;
