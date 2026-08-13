import RecipeCard from "../../components/recipe/RecipeCard";
import FilterPanel from "../../components/recipe/RecipeFilter";
import RecipeCardSkeleton from "../../components/recipe/RecipeCardSkeleton";
import style from "./RecipeListPage.module.css";
import { useEffect, useState } from "react";
import { getRecips } from "../../services/recipeSearchService";
import {
  filterRecipesByAllergies,
  filterRecipesByVeganType,
  getAllergenIdsByFilterState,
} from "../../utils/recipeFilter";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { getFavoriteRecipeIds, addFavorite, removeFavorite } from "../../services/favoriteService";
import { getUserSafetyConditions, getRecipeSafetyStatus } from "../../utils/recipeSafety";
import { getAiReplacedRecipeIds } from "../../services/aiRecipeService";
import { useSearchParams } from "react-router";

const RECIPE_LOAD_COUNT = 6;

const CARD_STATUS_MAP = {
  safe: "safe",
  danger: "warning",
  needReplacement: "replaceable",
};

const SORT_OPTIONS = [
  { value: "created", label: "등록순" },
  { value: "likes", label: "좋아요순" },
  { value: "difficulty", label: "난이도순" },
];

function recipeMatchesKeyword(recipe, keyword) {
  if (!keyword) return true;

  const normalizedKeyword = keyword.toLowerCase();

  const searchableText = [
    recipe.title,
    recipe.description,
    ...(recipe.recipe_ingredients ?? []).map((item) => item.ingredients?.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedKeyword);
}

function RecipeListPage() {
  const { user: authUser, loading: authLoading } = useAuth();

  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(RECIPE_LOAD_COUNT);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortType, setSortType] = useState("created");

  const [veganFilter, setVeganFilter] = useState(null);
  const [allergyFilters, setAllergyFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({
    allergyOptions: [],
    allergenCategoryMappings: [],
    veganOptions: [],
    veganTypeRestrictions: [],
  });
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState(() => new Set());
  const [safetyConditions, setSafetyConditions] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get("q")?.trim() ?? "";
  const [searchValue, setSearchValue] = useState(keyword);

  const handleSearch = () => {
    const nextKeyword = searchValue.trim();

    if (!nextKeyword) {
      searchParams.delete("q");
      setSearchParams(searchParams);
      return;
    }

    setSearchParams({ q: nextKeyword });
  };

  const defaultVeganTypeId =
    filterOptions.veganOptions.find(veganType => veganType.name === "일반")?.id ?? null;

  useEffect(() => {
    let isActive = true;

    async function loadFilterOptions() {
      const [allergensResult, veganTypesResult, mappingsResult, restrictionsResult] =
        await Promise.all([
          supabase.from("allergens").select("id, name").order("name"),
          supabase.from("vegan_types").select("id, name").order("name"),
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
        console.error("[RecipeListPage] 필터 옵션 조회 실패:", error);
        return;
      }

      setFilterOptions({
        allergyOptions: allergensResult.data ?? [],
        allergenCategoryMappings: mappingsResult.data ?? [],
        veganOptions: veganTypesResult.data ?? [],
        veganTypeRestrictions: restrictionsResult.data ?? [],
      });
    }

    loadFilterOptions();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      setVeganFilter(defaultVeganTypeId);
      setAllergyFilters({});
      return;
    }

    let isActive = true;

    async function loadUserFilters() {
      const [
        { data: profileData, error: profileError },
        { data: allergyRows, error: allergyError },
      ] = await Promise.all([
        supabase.from("profiles").select("vegan_type_id").eq("id", authUser.id).maybeSingle(),
        supabase.from("user_allergies").select("allergen_id").eq("user_id", authUser.id),
      ]);

      if (!isActive) return;

      if (profileError) {
        console.error("[RecipeListPage] vegan_type_id 조회 실패:", profileError);
      } else {
        setVeganFilter(profileData?.vegan_type_id ?? defaultVeganTypeId);
      }

      if (allergyError) {
        console.error("[RecipeListPage] user_allergies 조회 실패:", allergyError);
      } else {
        const nextAllergyFilters = (allergyRows ?? []).reduce((acc, row) => {
          if (row.allergen_id != null) {
            acc[String(row.allergen_id)] = "exclude";
          }
          return acc;
        }, {});

        setAllergyFilters(nextAllergyFilters);
      }
    }

    loadUserFilters();

    return () => {
      isActive = false;
    };
  }, [authUser, authLoading, defaultVeganTypeId]);

  useEffect(() => {
    async function loadFavoriteIds() {
      if (authLoading || !authUser) {
        setFavoriteRecipeIds(new Set());
        return;
      }

      const ids = await getFavoriteRecipeIds(authUser.id);
      setFavoriteRecipeIds(new Set(ids));
    }

    loadFavoriteIds();
  }, [authUser, authLoading]);

  const handleFavoriteClick = async (recipeId) => {
    if (!authUser) {
      alert("로그인이 필요합니다.");
      return;
    }

    const isCurrentlyFavorite = favoriteRecipeIds.has(recipeId);

    if (isCurrentlyFavorite) {
      await removeFavorite(authUser.id, recipeId);
    } else {
      await addFavorite(authUser.id, recipeId);
    }

    setFavoriteRecipeIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyFavorite) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });

    setRecipes((prev) =>
      prev.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              likes: Math.max(0, (recipe.likes ?? 0) + (isCurrentlyFavorite ? -1 : 1)),
            }
          : recipe,
      ),
    );
  };

  const activeAllergyOptions =
    safetyConditions?.allergyOptions?.length > 0
      ? safetyConditions.allergyOptions
      : filterOptions.allergyOptions;
  const activeAllergenCategoryMappings =
    safetyConditions?.allergenCategoryMappings ?? filterOptions.allergenCategoryMappings;
  const activeVeganOptions =
    safetyConditions?.veganOptions?.length > 0 ? safetyConditions.veganOptions : filterOptions.veganOptions;
  const activeVeganTypeRestrictions =
    safetyConditions?.veganTypeRestrictions ?? filterOptions.veganTypeRestrictions;
  const selectedAllergenIds = getAllergenIdsByFilterState(allergyFilters, [
    "warning",
    "exclude",
  ]);

  const effectiveConditions = {
    allergenIds: [
      ...new Set([...(safetyConditions?.allergenIds ?? []).map(String), ...selectedAllergenIds]),
    ],
    allergyOptions: activeAllergyOptions,
    allergenCategoryMappings: activeAllergenCategoryMappings,
    veganTypeId: veganFilter,
    veganTypeRestrictions: activeVeganTypeRestrictions,
  };

  const filteredRecipes = recipes.filter((recipe) => {
    if (!recipeMatchesKeyword(recipe, keyword)) return false;

    if (recipe.hasAiCustomRecipe) return true;

    const passesAllergyFilter =
      filterRecipesByAllergies([recipe], allergyFilters, activeAllergenCategoryMappings).length > 0;
    const passesVeganFilter =
      filterRecipesByVeganType([recipe], veganFilter, activeVeganTypeRestrictions).length > 0;

    return passesAllergyFilter && passesVeganFilter;
  });

  const recipesWithStatus = filteredRecipes.map((recipe) => {
    if (recipe.hasAiCustomRecipe) {
      return {
        ...recipe,
        status: "replaced",
      };
    }

    const safetyStatus = getRecipeSafetyStatus(recipe, effectiveConditions);

    return {
      ...recipe,
      status: CARD_STATUS_MAP[safetyStatus.safetyType] ?? "safe",
    };
  });

  const visibleRecipes = recipesWithStatus.slice(0, visibleCount);
  const hasMoreRecipes = visibleCount < recipesWithStatus.length;

  useEffect(() => {
    if (authLoading) return;

    async function loadRecipes() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const [loadedRecipes, conditions] = await Promise.all([
          getRecips(sortType),
          authUser ? getUserSafetyConditions(authUser.id) : Promise.resolve(null),
        ]);

        const aiReplacedIds = authUser
          ? await getAiReplacedRecipeIds(
              authUser.id,
              loadedRecipes.map((recipe) => recipe.id),
              conditions,
            )
          : new Set();

        setRecipes(
          loadedRecipes.map((recipe) => ({
            ...recipe,
            hasAiCustomRecipe: aiReplacedIds.has(String(recipe.id)),
          })),
        );

        if (conditions) {
          setFilterOptions({
            allergyOptions: conditions.allergyOptions ?? [],
            allergenCategoryMappings: conditions.allergenCategoryMappings ?? [],
            veganOptions: conditions.veganOptions ?? [],
            veganTypeRestrictions: conditions.veganTypeRestrictions ?? [],
          });
        }

        setSafetyConditions(conditions);
        setVisibleCount(RECIPE_LOAD_COUNT);
      } catch (error) {
        console.error("[HankkiLab] 레시피 조회 실패", error);
        setErrorMessage("레시피 목록을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadRecipes();
  }, [sortType, authUser, authLoading]);

  const handleLoadMore = () => {
    setVisibleCount((prevCount) => prevCount + RECIPE_LOAD_COUNT);
  };

  const handleSortChange = (event) => {
    setSortType(event.target.value);
  };

  return (
    <div className={style.main}>
      <div className="container">
        <h2 className={`${style.title} text-title-m`}>레시피 둘러보기</h2>

        <div className={style.searchArea}>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="재료나 메뉴를 검색해보세요"
            className={style.searchInput}
          />
          <button type="button" onClick={handleSearch} className={style.searchButton}>
            검색
          </button>
        </div>

        <FilterPanel
          allergyFilters={allergyFilters}
          onAllergyChange={setAllergyFilters}
          allergyOptions={activeAllergyOptions}
          veganFilter={veganFilter}
          onVeganChange={setVeganFilter}
          veganOptions={activeVeganOptions}
        />
        <div className={style.totalASortArea}>
          <h3 className="text-l">총 {filteredRecipes.length}개</h3>
          <label className={style.sortSelectLabel}>
            <select
              className={style.sortSelect}
              value={sortType}
              onChange={handleSortChange}
              aria-label="레시피 정렬"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!isLoading && errorMessage && (
          <p className={`${style.errorMessage} text-s`}>{errorMessage}</p>
        )}

        <div className={style.recipeCardArea}>
          {isLoading
            ? Array.from({ length: RECIPE_LOAD_COUNT }).map((_, index) => (
                <RecipeCardSkeleton key={index} />
              ))
            : visibleRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipeId={recipe.id}
                  imageUrl={recipe.image_url}
                  difficulty={recipe.difficulty}
                  name={recipe.title}
                  description={recipe.description}
                  time={recipe.cooking_time}
                  serves={recipe.servings}
                  likes={recipe.likes ?? 0}
                  status={recipe.status}
                  isFavorite={favoriteRecipeIds.has(recipe.id)}
                  onFavoriteClick={() => handleFavoriteClick(recipe.id)}
                />
              ))}
        </div>

        {!isLoading && hasMoreRecipes && (
          <div className={style.loadMoreArea}>
            <button
              type="button"
              className={`${style.loadMoreButton} text-button-l`}
              onClick={handleLoadMore}
            >
              더보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecipeListPage;
