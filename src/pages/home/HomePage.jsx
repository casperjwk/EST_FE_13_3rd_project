import { useState, useEffect, useMemo, Fragment } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  getFavoriteRecipeIds,
  addFavorite,
  removeFavorite,
  getFavoriteCounts,
} from '../../services/favoriteService';
import { getRecipesByVeganType } from '../../services/recipeService';
import { getUserSafetyConditions, getRecipeSafetyStatus } from '../../utils/recipeSafety';
import hero1 from '../../assets/hero1.png';
import hero2 from '../../assets/hero2.png';
import hero3 from '../../assets/hero3.png';
import RecipeCard from '../../components/recipe/RecipeCard';
import styles from './HomePage.module.css';

const SLIDES = [
  {
    title: (
      <>오늘 뭐 먹지 고민 대신,<br />안심하고 골라보세요</>
    ),
    desc: '알레르기와 식단 정보를 알려주시면, 딱 맞는 레시피만 골라드려요',
    image: hero1,
  },
  {
    title: 'AI가 위험재료 찾아줘요',
    desc: '레시피 재료 중 알레르기 위험 요소를 AI가 자동으로 분석해드려요',
    image: hero2,
  },
  {
    title: '대체재료로 바꿔줘요',
    desc: '위험한 재료는 안전한 대체재료로 바꿔서 레시피를 완성해드려요',
    image: hero3,
  },
];

const STEPS = [
  { icon: 'assignment', title: '알레르기·식단 정보 입력', desc: '내 조건을 한 번만 등록하면 끝' },
  { icon: 'smart_toy', title: 'AI가 재료 분석', desc: '등록된 정보 기준 위험 재료 확인' },
  { icon: 'restaurant', title: '맞춤 레시피 추천', desc: '대체재료까지 함께 제안받기' },
];

const VEGAN_TABS = ['전체', '비건', '락토', '오보', '페스코'];
const VEGAN_TABS_MORE = ['일반', '플렉시테리언', '폴로', '락토-오보'];

const VEGAN_TAB_ID_MAP = {
  '전체': null,
  '비건': 'vegan',
  '락토': 'lacto',
  '오보': 'ovo',
  '페스코': 'pesco',
  '일반': 'general',
  '플렉시테리언': 'flexitarian',
  '폴로': 'pollo',
  '락토-오보': 'lacto_ovo',
};

const SAFETY_TYPE_TO_STATUS = {
  danger: 'warning',
  needReplacement: 'replaceable',
  safe: 'safe',
};

function HomePage() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchValue, setSearchValue] = useState('');
  const [heroConditions, setHeroConditions] = useState({ veganTypeName: '', allergyNames: [] });

  const [conditions, setConditions] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  const [allRecipes, setAllRecipes] = useState([]);
  const [allCounts, setAllCounts] = useState({});

  useEffect(() => {
    let isActive = true;
    getRecipesByVeganType(null, 9999).then(async (recipes) => {
      if (!isActive) return;
      setAllRecipes(recipes);
      const counts = await getFavoriteCounts(recipes.map((r) => r.id));
      if (!isActive) return;
      setAllCounts(counts);
    });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setConditions(null);
      setFavoriteIds(new Set());
      setHeroConditions({ veganTypeName: '', allergyNames: [] });
      return;
    }
    let isActive = true;

    Promise.all([getUserSafetyConditions(user.id), getFavoriteRecipeIds(user.id)]).then(
      ([conditionsResult, favIds]) => {
        if (!isActive) return;
        setConditions(conditionsResult);
        setFavoriteIds(new Set(favIds));

        if (conditionsResult) {
          const allergyNames = conditionsResult.allergyOptions
            .filter((a) => conditionsResult.allergenIds.includes(a.id))
            .map((a) => a.name);
          setHeroConditions({ veganTypeName: conditionsResult.veganTypeName, allergyNames });
        }
      },
    );

    return () => {
      isActive = false;
    };
  }, [user]);

  const toggleFavorite = async (recipeId) => {
    if (!user) return;
    const isFav = favoriteIds.has(recipeId);
    if (isFav) {
      await removeFavorite(user.id, recipeId);
    } else {
      await addFavorite(user.id, recipeId);
    }
    const delta = isFav ? -1 : 1;

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });

    setAllCounts((prev) => ({ ...prev, [recipeId]: Math.max(0, (prev[recipeId] ?? 0) + delta) }));
  };

  const handleSearch = () => {
    if (!searchValue.trim()) return;
    navigate(`/recipes?q=${encodeURIComponent(searchValue.trim())}`);
  };

  const popularRecipes = useMemo(
    () =>
      [...allRecipes].sort((a, b) => (allCounts[b.id] ?? 0) - (allCounts[a.id] ?? 0)).slice(0, 4),
    [allRecipes, allCounts],
  );

  const displayedFavorites = useMemo(
    () => allRecipes.filter((recipe) => favoriteIds.has(recipe.id)),
    [allRecipes, favoriteIds],
  );

  const [activeVeganTab, setActiveVeganTab] = useState('전체');
  const [showAllVeganTabs, setShowAllVeganTabs] = useState(false);
  const [veganLoading, setVeganLoading] = useState(false);
  const [veganRecipes, setVeganRecipes] = useState([]);

  const loadVeganRecipes = async (tab) => {
    setVeganLoading(true);
    const recipes = await getRecipesByVeganType(VEGAN_TAB_ID_MAP[tab], 3);
    setVeganRecipes(recipes);
    setVeganLoading(false);
  };

  useEffect(() => {
    loadVeganRecipes('전체');
  }, []);

  const handleVeganTabClick = (tab) => {
    setActiveVeganTab(tab);
    loadVeganRecipes(tab);
  };

  return (
    <div className={styles['home-page']}>
      <section className={styles['home-hero']}>
        <div className={`container ${styles['home-hero__inner']}`}>
          <div className={styles['home-hero__badge']}>
            <span className={styles['home-hero__badge-dot']}></span>
            AI 기반 맞춤 레시피 서비스
          </div>

          <div className={styles['home-hero__track-wrapper']}>
            <div
              className={styles['home-hero__track']}
              style={{
                width: `${SLIDES.length * 100}%`,
                transform: `translateX(-${(100 / SLIDES.length) * current}%)`,
              }}
            >
              {SLIDES.map((slide, index) => (
                <div
                  className={styles['home-hero__slide']}
                  key={index}
                  style={{ width: `${100 / SLIDES.length}%` }}
                >
                  <div className={styles['home-hero__text-block']}>
                    <h1 className={`text-title-l ${styles['home-hero__title']}`}>
                      {slide.title}
                    </h1>
                    <p className={`text-m ${styles['home-hero__desc']}`}>
                      {slide.desc}
                    </p>
                  </div>
                  <img src={slide.image} alt={slide.desc} className={styles['home-hero__image']} />
                </div>
              ))}
            </div>
          </div>

          <div className={styles['home-hero__dots']}>
            <button
              className={styles['home-hero__nav-btn']}
              onClick={() => setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
              aria-label="이전 슬라이드"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>

            {SLIDES.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`${styles['home-hero__dot']} ${
                  index === current ? styles['home-hero__dot--active'] : ''
                }`}
                aria-label={`${index + 1}번째 슬라이드`}
              ></button>
            ))}

            <button
              className={styles['home-hero__nav-btn']}
              onClick={() => setCurrent((prev) => (prev + 1) % SLIDES.length)}
              aria-label="다음 슬라이드"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div className={styles['home-hero__stats']}>
            <span className={styles['home-hero__stat']}>
              <span className="material-symbols-outlined">check</span>
              AI 성분 분석
            </span>
            <span className={styles['home-hero__stat']}>
              <span className="material-symbols-outlined">check</span>
              알레르기 조건 반영
            </span>
            <span className={styles['home-hero__stat']}>
              <span className="material-symbols-outlined">check</span>
              비건 유형 8가지
            </span>
          </div>

          <div className={styles['home-hero__fixed-area']}>
            <div className={styles['home-hero__search-bar']}>
              <input
                type="text"
                placeholder="재료나 메뉴를 검색해보세요"
                className={styles['home-hero__search-input']}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className={`text-button-m ${styles['home-hero__search-btn']}`} onClick={handleSearch}>
                검색
              </button>
            </div>

            <div className={styles['home-hero__chips-cta']}>
              <div className={styles['home-hero__chips']}>
                {heroConditions.veganTypeName && (
                  <span className={styles['home-hero__chip']}>
                    <span className="material-symbols-outlined">check</span>
                    {heroConditions.veganTypeName}
                  </span>
                )}
                {heroConditions.allergyNames.map((name) => (
                  <span
                    key={name}
                    className={`${styles['home-hero__chip']} ${styles['home-hero__chip--warning']}`}
                  >
                    <span className="material-symbols-outlined">warning</span>
                    {name} 제외
                  </span>
                ))}
                {!user && (
                  <Link to="/login" className={styles['home-hero__chip']}>
                    로그인하고 내 조건 보기
                  </Link>
                )}
              </div>

              <button
                className={`text-button-l ${styles['home-hero__cta-btn']}`}
                onClick={() => navigate('/recipes')}
              >
                맞춤 레시피 찾기
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles['home-process']}>
        <div className={`container ${styles['home-process__inner']}`}>
          <div className={styles['home-process__header']}>
            <p className={styles['home-process__eyebrow']}>HOW IT WORKS</p>
            <h2 className={styles['home-process__heading']}>이렇게 찾아드려요</h2>
            <p className={styles['home-process__subheading']}>3단계로 안전한 레시피를 추천해요</p>
          </div>
          <div className={styles['home-process__steps']}>
            {STEPS.map((step, index) => (
              <Fragment key={index}>
                <div className={styles['home-process__step']}>
                  <div
                    className={`${styles['home-process__icon-circle']} ${styles[`home-process__icon-circle--${index}`]}`}
                  >
                    <span
                      className={`material-symbols-outlined ${styles['home-process__icon']} ${styles[`home-process__icon--${index}`]}`}
                    >
                      {step.icon}
                    </span>
                  </div>
                  <p className={styles['home-process__step-label']}>STEP 0{index + 1}</p>
                  <p className={styles['home-process__title']}>{step.title}</p>
                  <p className={styles['home-process__desc']}>{step.desc}</p>
                </div>
                {index < STEPS.length - 1 && (
                  <span className={`material-symbols-outlined ${styles['home-process__arrow']}`}>
                    arrow_forward
                  </span>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className={styles['home-favorites']}>
        <div className={`container ${styles['home-favorites__inner']}`}>
          <div className={styles['home-favorites__header']}>
            <h2 className={styles['home-favorites__title']}>즐겨찾는 레시피</h2>
            <Link to="/favorite" className={styles['home-favorites__more']}>더보기</Link>
          </div>
          <div className={styles['home-favorites__grid']}>
            {displayedFavorites.map((recipe) => {
              const safety = getRecipeSafetyStatus(recipe, conditions);
              return (
                <RecipeCard
                  key={recipe.id}
                  recipeId={recipe.id}
                  imageUrl={recipe.image_url}
                  difficulty={recipe.difficulty}
                  name={recipe.title}
                  description={recipe.description}
                  time={recipe.cooking_time}
                  serves={recipe.servings}
                  likes={allCounts[recipe.id] ?? 0}
                  isFavorite={true}
                  onFavoriteClick={() => toggleFavorite(recipe.id)}
                  status={SAFETY_TYPE_TO_STATUS[safety.safetyType]}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles['home-popular']}>
        <div className={`container ${styles['home-popular__inner']}`}>
          <h2 className={styles['home-popular__title']}>인기 레시피</h2>
          <div className={styles['home-popular__grid']}>
            {popularRecipes.map((recipe) => {
              const safety = getRecipeSafetyStatus(recipe, conditions);
              return (
                <RecipeCard
                  key={recipe.id}
                  recipeId={recipe.id}
                  imageUrl={recipe.image_url}
                  difficulty={recipe.difficulty}
                  name={recipe.title}
                  description={recipe.description}
                  time={recipe.cooking_time}
                  serves={recipe.servings}
                  likes={allCounts[recipe.id] ?? 0}
                  isFavorite={favoriteIds.has(recipe.id)}
                  onFavoriteClick={() => toggleFavorite(recipe.id)}
                  status={SAFETY_TYPE_TO_STATUS[safety.safetyType]}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles['home-vegan']}>
        <div className={`container ${styles['home-vegan__inner']}`}>
          <div className={styles['home-vegan__header']}>
            <h2 className={styles['home-vegan__title']}>비건 유형별 추천</h2>
          </div>

          <div className={styles['home-vegan__tabs']}>
            {VEGAN_TABS.map((tab) => (
              <button
                key={tab}
                className={`text-button-s ${styles['home-vegan__tab']} ${
                  activeVeganTab === tab ? styles['home-vegan__tab--active'] : ''
                }`}
                onClick={() => handleVeganTabClick(tab)}
              >
                {tab}
              </button>
            ))}
            {showAllVeganTabs &&
              VEGAN_TABS_MORE.map((tab) => (
                <button
                  key={tab}
                  className={`text-button-s ${styles['home-vegan__tab']} ${
                    activeVeganTab === tab ? styles['home-vegan__tab--active'] : ''
                  }`}
                  onClick={() => handleVeganTabClick(tab)}
                >
                  {tab}
                </button>
              ))}
            {!showAllVeganTabs && (
              <button
                className={`text-button-s ${styles['home-vegan__tab-more']}`}
                onClick={() => setShowAllVeganTabs(true)}
              >
                더보기
              </button>
            )}
          </div>

          {veganLoading ? (
            <div className={styles['home-vegan__loading']}>
              <div className={styles['home-vegan__spinner']}></div>
              <p className="text-s">맞춤 레시피를 불러오는 중이에요</p>
            </div>
          ) : (
            <div className={styles['home-vegan__grid']}>
              {veganRecipes.map((recipe) => {
                const safety = getRecipeSafetyStatus(recipe, conditions);
                return (
                  <RecipeCard
                    key={recipe.id}
                    recipeId={recipe.id}
                    imageUrl={recipe.image_url}
                    difficulty={recipe.difficulty}
                    name={recipe.title}
                    description={recipe.description}
                    time={recipe.cooking_time}
                    serves={recipe.servings}
                    likes={allCounts[recipe.id] ?? 0}
                    isFavorite={favoriteIds.has(recipe.id)}
                    onFavoriteClick={() => toggleFavorite(recipe.id)}
                    status={SAFETY_TYPE_TO_STATUS[safety.safetyType]}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default HomePage;