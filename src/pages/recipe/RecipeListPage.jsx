import RecipeCard from "../../components/recipe/RecipeCard";
import FilterPanel from "../../components/recipe/RecipeFilter";
import RecipeCardSkeleton from "../../components/recipe/RecipeCardSkeleton";
import style from "./RecipeListPage.module.css";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { getRecips } from "../../services/recipeSearchService";
import { filterRecipesByAllergies, filterRecipesByVeganType } from "../../utils/recipeFilter";


const RECIPE_LOAD_COUNT = 6;
const SORT_OPTIONS = [
  { value: "created", label: "등록순" },
  { value: "likes", label: "좋아요순" },
  { value: "difficulty", label: "난이도순" },
];

function RecipeListPage() {
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] =useState(RECIPE_LOAD_COUNT);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortType, setSortType] = useState("created");
  const [veganFilter, setVeganFilter] = useState("일반");
  const [allergyFilters, setAllergyFilters] = useState({});



const allergyFilteredRecipes = filterRecipesByAllergies(recipes, allergyFilters);
const filteredRecipes = filterRecipesByVeganType(allergyFilteredRecipes, veganFilter);

const visibleRecipes = filteredRecipes.slice(0, visibleCount);
const hasMoreRecipes = visibleCount < filteredRecipes.length;


  useEffect(() => {
    async function loadRecipes() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const recipes = await getRecips(sortType);
        setRecipes(recipes);
        setVisibleCount(RECIPE_LOAD_COUNT);
      } catch (error) {
        console.error("[HankkiLab] 레시피 조회 실패", error);
        setErrorMessage("레시피 목록을 불러오지 못했습니다.");
        return;
      }finally{
        setIsLoading(false);
      }
    }

    loadRecipes();
  },[sortType]);



  const handleRecipeClick = recipeId => {
    navigate(`/recipes/${recipeId}`);
  };

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
          imageUrl={recipe.image_url}
          difficulty={recipe.difficulty}
          name={recipe.title}
          description={recipe.description}
          time={recipe.cooking_time}
          serves={recipe.servings}
          likes={recipe.likes ?? 0}
          onClick={()=> handleRecipeClick(recipe.id)}
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
