import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { createRecipe, getFoodCategories } from "../../services/recipeService";
import { getAdminAccessStatus } from "../../services/adminAccess";
import "./RecipeCreatePage.css";

const CATEGORY_GROUP_DEFINITIONS = [
  {
    label: "육류",
    categoryIds: ["pork", "chicken", "beef", "meat"],
  },
  {
    label: "해산물",
    categoryIds: ["fish", "shrimp", "crab", "shellfish", "seafood"],
  },
  {
    label: "동물성 식품",
    categoryIds: ["dairy", "eggs", "honey"],
  },
  {
    label: "주요 알레르기 관련",
    categoryIds: ["wheat", "soy", "peanut", "nuts", "peach", "tomato"],
  },
  {
    label: "일반 식재료",
    categoryIds: [
      "vegetable",
      "grain",
      "seaweed",
      "mushroom",
      "seasoning",
      "condiments",
      "kimchi",
      "salt-fermented",
      "oil",
      "water",
      "other",
    ],
  },
];

function groupFoodCategories(categories) {
  const categoryMap = new Map(categories.map(category => [category.id, category]));
  const groupedIds = new Set(CATEGORY_GROUP_DEFINITIONS.flatMap(group => group.categoryIds));
  const groups = CATEGORY_GROUP_DEFINITIONS.map(group => ({
    label: group.label,
    items: group.categoryIds.map(id => categoryMap.get(id)).filter(Boolean),
  })).filter(group => group.items.length > 0);
  const ungroupedItems = categories.filter(category => !groupedIds.has(category.id));

  return ungroupedItems.length > 0
    ? [...groups, { label: "기타 카테고리", items: ungroupedItems }]
    : groups;
}

const emptyIngredient = id => ({
  id,
  name: "",
  categoryKey: null,
  categoryLabel: null,
  amount: "",
});
const emptyStep = id => ({ id, description: "" });

// Supabase 및 네트워크 오류를 사용자에게 보여 줄 한글 메시지로 변환합니다.
function getRecipeCreateErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "레시피를 등록할 권한이 없습니다. 관리자 계정을 확인해 주세요.";
  }
  if (message.includes("duplicate key") || error?.code === "23505") {
    return "이미 등록된 정보와 중복되는 항목이 있습니다.";
  }
  if (message.includes("not-null") || message.includes("null value") || error?.code === "23502") {
    return "필수 입력 항목을 모두 입력해 주세요.";
  }
  if (message.includes("invalid input syntax") || error?.code === "22P02") {
    return "입력값의 형식이 올바르지 않습니다.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (message.includes("jwt") || message.includes("unauthorized")) {
    return "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.";
  }
  if (message.includes("image") || message.includes("storage") || message.includes("bucket")) {
    return "이미지를 업로드하지 못했습니다. 파일을 확인해 주세요.";
  }

  return "레시피 등록에 실패했습니다. 입력 내용을 확인한 후 다시 시도해 주세요.";
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function RecipeCreatePage() {
  const navigate = useNavigate();
  const nextIngredientId = useRef(2);
  const nextStepId = useRef(3);
  const imageInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [ingredients, setIngredients] = useState([emptyIngredient(1)]);
  const [detailSteps, setDetailSteps] = useState([emptyStep(1)]);
  const [simpleSteps, setSimpleSteps] = useState([emptyStep(2)]);
  const [servings, setServings] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [difficulty, setDifficulty] = useState(null);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [categoryError, setCategoryError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [accessStatus, setAccessStatus] = useState("checking");

  useEffect(() => {
    let isActive = true;

    async function checkCreatePermission() {
      try {
        const status = await getAdminAccessStatus();
        if (!isActive) return;
        setAccessStatus(status);
      } catch (error) {
        console.error("[HankkiLab] Recipe create permission check failed:", error);
        if (isActive) setAccessStatus("denied");
      }
    }

    void checkCreatePermission();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (accessStatus !== "allowed") return undefined;

    let isActive = true;

    getFoodCategories()
      .then(categories => {
        if (isActive) {
          setCategoryGroups(groupFoodCategories(categories));
          setCategoryError("");
        }
      })
      .catch(error => {
        console.error("[HankkiLab] Food categories error:", error);
        if (isActive) setCategoryError("카테고리를 불러오지 못했습니다.");
      });

    return () => {
      isActive = false;
      clearTimeout(toastTimerRef.current);
    };
  }, [accessStatus]);

  const showToast = message => {
    clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(""), 2800);
  };

  // 지정한 입력 요소가 보이도록 스크롤한 뒤 포커스를 이동합니다.
  const focusInvalidField = selector => {
    window.requestAnimationFrame(() => {
      const field = document.querySelector(selector);
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus({ preventScroll: true });
    });
  };

  const handleImageChange = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ({ target }) => setImagePreview(target?.result ?? "");
    reader.readAsDataURL(file);
  };

  const updateIngredient = (id, patch) => {
    setIngredients(items => items.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addIngredient = () => {
    setIngredients(items => [...items, emptyIngredient(nextIngredientId.current++)]);
  };

  const addStep = setter => {
    setter(items => [...items, emptyStep(nextStepId.current++)]);
  };

  const updateStep = (setter, id, descriptionValue) => {
    setter(items =>
      items.map(item => (item.id === id ? { ...item, description: descriptionValue } : item)),
    );
  };

  const submitRecipe = async event => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast("레시피 제목을 입력해 주세요.");
      focusInvalidField("#recipe-title");
      return;
    }

    if (ingredients.length === 0) {
      const ingredientId = nextIngredientId.current++;
      setIngredients([emptyIngredient(ingredientId)]);
      showToast("재료를 한 개 이상 입력해 주세요.");
      focusInvalidField(`[data-ingredient-name="${ingredientId}"]`);
      return;
    }

    const firstEmptyIngredientName = ingredients.find(ingredient => !ingredient.name.trim());
    if (firstEmptyIngredientName) {
      showToast("재료명을 입력해 주세요.");
      focusInvalidField(`[data-ingredient-name="${firstEmptyIngredientName.id}"]`);
      return;
    }

    const firstEmptyIngredientCategory = ingredients.find(ingredient => !ingredient.categoryKey);
    if (firstEmptyIngredientCategory) {
      showToast("재료 카테고리를 선택해 주세요.");
      focusInvalidField(`[data-ingredient-category="${firstEmptyIngredientCategory.id}"]`);
      return;
    }

    if (detailSteps.length === 0) {
      const stepId = nextStepId.current++;
      setDetailSteps([emptyStep(stepId)]);
      showToast("상세 조리순서를 한 단계 이상 입력해 주세요.");
      focusInvalidField(`[data-detail-step="${stepId}"]`);
      return;
    }

    const firstEmptyDetailStep = detailSteps.find(step => !step.description.trim());
    if (firstEmptyDetailStep) {
      showToast("상세 조리순서를 입력해 주세요.");
      focusInvalidField(`[data-detail-step="${firstEmptyDetailStep.id}"]`);
      return;
    }

    if (simpleSteps.length === 0) {
      const stepId = nextStepId.current++;
      setSimpleSteps([emptyStep(stepId)]);
      showToast("간단 조리순서를 한 단계 이상 입력해 주세요.");
      focusInvalidField(`[data-simple-step="${stepId}"]`);
      return;
    }

    const firstEmptySimpleStep = simpleSteps.find(step => !step.description.trim());
    if (firstEmptySimpleStep) {
      showToast("간단 조리순서를 입력해 주세요.");
      focusInvalidField(`[data-simple-step="${firstEmptySimpleStep.id}"]`);
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      ingredients: ingredients
        .filter(({ name }) => name.trim())
        .map(({ name, categoryKey, amount }) => ({
          name: name.trim(),
          category_id: categoryKey,
          amount: amount.trim() || null,
        })),
      cooking_steps: {
        detail: detailSteps
          .filter(({ description: text }) => text.trim())
          .map(({ description: text }, index) => ({ step: index + 1, description: text.trim() })),
        simple: simpleSteps
          .filter(({ description: text }) => text.trim())
          .map(({ description: text }, index) => ({ step: index + 1, description: text.trim() })),
      },
      servings: servings ? Number.parseInt(servings, 10) : null,
      cooking_time: cookTime ? Number.parseInt(cookTime, 10) : null,
      difficulty,
    };

    try {
      setIsSubmitting(true);
      await createRecipe(payload, imageFile);
      navigate("/admin", { replace: true });
    } catch (error) {
      console.error("[HankkiLab] Recipe creation error:", error);
      showToast(getRecipeCreateErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSteps = (steps, setter, simple = false) => (
    <div className="recipe-create-step-list">
      {steps.map((step, index) => (
        <div className="recipe-create-step-row" key={step.id}>
          <div className="recipe-create-step-badge">{index + 1}</div>
          <div className="recipe-create-step-body">
            <textarea
              className={simple ? "short" : ""}
              data-detail-step={simple ? undefined : step.id}
              data-simple-step={simple ? step.id : undefined}
              value={step.description}
              onChange={event => updateStep(setter, step.id, event.target.value)}
              placeholder={simple ? "간단 조리 단계를 입력하세요" : "상세 조리 단계를 입력하세요"}
            />
          </div>
          <button
            type="button"
            className="recipe-create-delete-button"
            onClick={() => setter(items => items.filter(item => item.id !== step.id))}
            title="삭제"
            aria-label={`${index + 1}단계 삭제`}
          >
            <DeleteIcon />
          </button>
        </div>
      ))}
    </div>
  );

  if (accessStatus === "checking") {
    return (
      <main className="recipe-create-access-message">
        <p>접근 권한을 확인하고 있습니다.</p>
      </main>
    );
  }

  if (accessStatus === "signed-out") {
    return (
      <main className="recipe-create-access-message">
        <p>로그인이 필요한 페이지입니다.</p>
      </main>
    );
  }

  if (accessStatus === "denied") {
    return (
      <main className="recipe-create-access-message" role="alert">
        <p>허가된 사용자가 아니라면 접근할 수 없는 페이지입니다.</p>
      </main>
    );
  }

  return (
    <div className="recipe-create-page" onClick={() => setOpenCategoryId(null)}>
      <div className="recipe-create-header">
        <div className="recipe-create-logo">HankkiLab Admin</div>
        <h1>레시피 등록</h1>
      </div>

      <form className="recipe-create-form" onSubmit={submitRecipe}>
        <section className="recipe-create-card">
          <h2 className="recipe-create-card-title">대표 이미지</h2>
          <button
            type="button"
            className={`recipe-create-upload${imagePreview ? " has-image" : ""}`}
            onClick={() => imageInputRef.current?.click()}
          >
            <svg
              className="upload-icon"
              width="44"
              height="44"
              viewBox="0 0 44 44"
              fill="none"
              aria-hidden="true"
            >
              <rect width="44" height="44" rx="10" fill="#f0f0f0" />
              <path
                d="M22 14v10m0 0-4-4m4 4 4-4"
                stroke="#bbb"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="10" y="28" width="24" height="6" rx="3" fill="#e8e8e8" />
            </svg>
            <span className="upload-label">클릭하여 이미지 업로드</span>
            <span className="upload-hint">JPG, PNG, WEBP · 최대 10MB</span>
            {imagePreview && (
              <img
                className="recipe-create-image-preview"
                src={imagePreview}
                alt="레시피 미리보기"
              />
            )}
          </button>
          <input
            ref={imageInputRef}
            className="recipe-create-file-input"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
          />
        </section>

        <section className="recipe-create-card">
          <h2 className="recipe-create-card-title">기본 정보</h2>
          <div className="recipe-create-field">
            <label htmlFor="recipe-title">
              레시피 제목 <span className="required">*</span>
            </label>
            <input
              id="recipe-title"
              type="text"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="레시피 제목을 입력하세요"
            />
          </div>
          <div className="recipe-create-field">
            <label htmlFor="recipe-description">간단 소개</label>
            <textarea
              id="recipe-description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="레시피를 간단히 소개해 주세요"
            />
          </div>
        </section>

        <section className="recipe-create-card">
          <h2 className="recipe-create-card-title">재료</h2>
          <div className="recipe-create-ingredient-list">
            {ingredients.map(ingredient => (
              <div className="recipe-create-ingredient-row" key={ingredient.id}>
                <input
                  className="ingredient-name"
                  data-ingredient-name={ingredient.id}
                  type="text"
                  value={ingredient.name}
                  onChange={event => updateIngredient(ingredient.id, { name: event.target.value })}
                  placeholder="재료명"
                />
                <div
                  className="recipe-create-category-wrap"
                  onClick={event => event.stopPropagation()}
                >
                  <button
                    type="button"
                    data-ingredient-category={ingredient.id}
                    className={`recipe-create-category-button${ingredient.categoryKey ? " selected" : ""}${openCategoryId === ingredient.id ? " open" : ""}`}
                    onClick={() =>
                      setOpenCategoryId(id => (id === ingredient.id ? null : ingredient.id))
                    }
                  >
                    <span>{ingredient.categoryLabel || "카테고리"}</span>
                    <svg
                      className="category-arrow"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="m2 4 4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {openCategoryId === ingredient.id && (
                    <div className="recipe-create-category-panel">
                      {categoryError && (
                        <div className="recipe-create-category-title">{categoryError}</div>
                      )}
                      {!categoryError && categoryGroups.length === 0 && (
                        <div className="recipe-create-category-title">
                          카테고리를 불러오는 중입니다.
                        </div>
                      )}
                      {categoryGroups.map(group => (
                        <div className="recipe-create-category-group" key={group.label}>
                          <div className="recipe-create-category-title">{group.label}</div>
                          <div className="recipe-create-category-chips">
                            {group.items.map(category => (
                              <button
                                type="button"
                                key={category.id}
                                className={`recipe-create-category-chip${ingredient.categoryKey === category.id ? " active" : ""}`}
                                onClick={() => {
                                  updateIngredient(ingredient.id, {
                                    categoryKey: category.id,
                                    categoryLabel: category.name,
                                  });
                                  setOpenCategoryId(null);
                                }}
                              >
                                {category.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  className="amount-input"
                  type="text"
                  value={ingredient.amount}
                  onChange={event =>
                    updateIngredient(ingredient.id, { amount: event.target.value })
                  }
                  placeholder="300g"
                />
                <button
                  type="button"
                  className="recipe-create-delete-button"
                  onClick={() =>
                    setIngredients(items => items.filter(item => item.id !== ingredient.id))
                  }
                  title="삭제"
                  aria-label={`${ingredient.name || "재료"} 삭제`}
                >
                  <DeleteIcon />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="recipe-create-add-button" onClick={addIngredient}>
            <PlusIcon />
            재료 추가
          </button>
        </section>

        <section className="recipe-create-card">
          <h2 className="recipe-create-card-title">상세 조리순서</h2>
          {renderSteps(detailSteps, setDetailSteps)}
          <button
            type="button"
            className="recipe-create-add-button"
            onClick={() => addStep(setDetailSteps)}
          >
            <PlusIcon />
            단계 추가
          </button>
        </section>

        <section className="recipe-create-card">
          <h2 className="recipe-create-card-title">간단 조리순서</h2>
          {renderSteps(simpleSteps, setSimpleSteps, true)}
          <button
            type="button"
            className="recipe-create-add-button"
            onClick={() => addStep(setSimpleSteps)}
          >
            <PlusIcon />
            단계 추가
          </button>
        </section>

        <section className="recipe-create-card">
          <h2 className="recipe-create-card-title">요리 정보</h2>
          <div className="recipe-create-two-column">
            <div className="recipe-create-field">
              <label htmlFor="recipe-servings">몇 인분</label>
              <input
                id="recipe-servings"
                type="number"
                min="1"
                value={servings}
                onChange={event => setServings(event.target.value)}
                placeholder="2"
              />
            </div>
            <div className="recipe-create-field">
              <label htmlFor="recipe-cook-time">조리 시간 (분)</label>
              <input
                id="recipe-cook-time"
                type="number"
                min="1"
                value={cookTime}
                onChange={event => setCookTime(event.target.value)}
                placeholder="30"
              />
            </div>
          </div>
          <div className="recipe-create-field difficulty-field">
            <span className="field-label">난이도</span>
            <div className="recipe-create-difficulty-group">
              {[
                ["easy", "쉬움"],
                ["normal", "보통"],
                ["hard", "어려움"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={`recipe-create-difficulty-button${difficulty === value ? " active" : ""}`}
                  onClick={() => setDifficulty(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <button className="recipe-create-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "등록 중..." : "등록하기"}
        </button>
      </form>

      <div
        className={`recipe-create-toast${toast ? " show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}
