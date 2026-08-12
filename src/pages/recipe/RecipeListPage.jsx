import RecipeCard from "../../components/recipe/RecipeCard";
import FilterPanel from "../../components/recipe/RecipeFilter";
import RecipeCardSkeleton from "../../components/recipe/RecipeCardSkeleton";
import style from "./RecipeListPage.module.css";
import { useEffect, useState } from "react";
import { getRecips } from "../../services/recipeSearchService";
import { filterRecipesByAllergies, filterRecipesByVeganType } from "../../utils/recipeFilter";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  getFavoriteRecipeIds,
  addFavorite,
  removeFavorite,
} from "../../services/favoriteService";
import { 
  getUserSafetyConditions,
  getRecipeSafetyStatus,
 } from "../../utils/recipeSafety";


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

function RecipeListPage() {
  const { user: authUser, loading: authLoading } =useAuth();

  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] =useState(RECIPE_LOAD_COUNT);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortType, setSortType] = useState("created");
  const [veganFilter, setVeganFilter] = useState("일반");
  const [allergyFilters, setAllergyFilters] = useState({});
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState(() => new Set());
  const [safetyConditions, setSafetyConditions] = useState(null);


  useEffect(() => {
  if (authLoading) return;

  if (!authUser) {
    setVeganFilter("일반");
    setAllergyFilters({});
    return;
  }

  
  
  let isActive = true;
  
  async function loadUserFilters() {
    const [{ data: profileData, error: profileError }, { data: allergyRows, error: allergyError }] =
    await Promise.all([
      supabase.from("profiles").select("vegan_type_id").eq("id", authUser.id).maybeSingle(),
      supabase
      .from("user_allergies")
      .select("allergens(name)")
      .eq("user_id", authUser.id),
    ]);
    
    if (!isActive) return;
    
    if (profileError) {
      console.error("[RecipeListPage] vegan_type_id 조회 실패:", profileError);
    } else if (profileData?.vegan_type_id) {
      const { data: veganTypeData, error: veganTypeError } = await supabase
      .from("vegan_types")
      .select("name")
      .eq("id", profileData.vegan_type_id)
      .maybeSingle();
      
      if (!isActive) return;
      
      if (veganTypeError) {
        console.error("[RecipeListPage] vegan type 조회 실패:", veganTypeError);
      } else {
        setVeganFilter(veganTypeData?.name ?? "일반");
      }
    }
    
    if (allergyError) {
      console.error("[RecipeListPage] user_allergies 조회 실패:", allergyError);
    } else {
      const nextAllergyFilters = (allergyRows ?? []).reduce((acc, row) => {
        const allergen = Array.isArray(row.allergens) ? row.allergens[0] : row.allergens;
        if (allergen?.name) {
          acc[allergen.name] = "exclude";
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
}, [authUser, authLoading]);

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

const handleFavoriteClick = async recipeId => {
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

setFavoriteRecipeIds(prev => {
  const next = new Set(prev);
  isCurrentlyFavorite ? next.delete(recipeId) : next.add(recipeId);
  return next;
});

setRecipes(prev =>
  prev.map(recipe =>
    recipe.id === recipeId
      ? {
          ...recipe,
          likes: Math.max(0, (recipe.likes ?? 0) + (isCurrentlyFavorite ? -1 : 1)),
        }
      : recipe,
  ),
);
};

const warningAllergyNames = Object.entries(allergyFilters)
  .filter(([,state]) => state === "warning")
  .map(([name])=>name);
const warningAllergenIds = (
  safetyConditions?.allergyOptions ?? []
)
  .filter(allergen =>
    warningAllergyNames.includes(allergen.name),
  )
  .map(allergen => allergen.id);



const effectiveConditions = safetyConditions
  ? {
      ...safetyConditions,
      allergenIds: [
        ...new Set([
          ...(safetyConditions.allergenIds ?? []).map(String),
          ...warningAllergenIds.map(String),
        ]),
      ],
    }
  : null;

const allergyFilteredRecipes = filterRecipesByAllergies(recipes, allergyFilters);
const filteredRecipes = filterRecipesByVeganType(allergyFilteredRecipes, veganFilter);

const recipesWithStatus = filteredRecipes.map(recipe => {
  const safetyStatus = getRecipeSafetyStatus(
    recipe,
    effectiveConditions,
  );

  return {
    ...recipe,
    status:
      CARD_STATUS_MAP[safetyStatus.safetyType] ?? "safe",
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
        authUser
          ? getUserSafetyConditions(authUser.id)
          : Promise.resolve(null),
      ]);

      
      setRecipes(loadedRecipes);
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

  const handleLoadMore = () =>{
    setVisibleCount(prevCount => prevCount + RECIPE_LOAD_COUNT);
  }

  const handleSortChange = event => {
    setSortType(event.target.value);
  };


  

  return (
    <div className={style.main}>
      <div className="container">
        <h2 className={`${style.title} text-title-m`}>레시피 둘러보기</h2>
        <FilterPanel
          allergyFilters={allergyFilters}
          onAllergyChange={setAllergyFilters}
          veganFilter={veganFilter}
          onVeganChange={setVeganFilter}
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
              {SORT_OPTIONS.map(option => (
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
        ? Array.from({length: RECIPE_LOAD_COUNT}).map((_, index)=>(
          <RecipeCardSkeleton key={index}/>
        ))
        : visibleRecipes.map((recipe) =>(
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
        ))
        
      }
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
