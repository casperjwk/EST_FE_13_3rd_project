import { useState, Fragment } from 'react';
import { useNavigate, Link } from 'react-router';
import hero1 from '../../assets/hero1.png';
import hero2 from '../../assets/hero2.png';
import hero3 from '../../assets/hero3.png';
import RecipeCard from '../../components/recipe/RecipeCard';
import FavoriteRecipeCard from './FavoriteRecipeCard';
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
  { icon: 'assignment', title: '알레르기·비건 정보 입력', desc: '내 조건을 한 번만 등록하면 끝' },
  { icon: 'smart_toy', title: 'AI가 재료 분석', desc: '등록된 정보 기준 위험 재료 확인' },
  { icon: 'restaurant', title: '맞춤 레시피 추천', desc: '대체재료까지 함께 제안받기' },
];

// TODO: 실제 데이터로 교체 (더미 데이터)
const FAVORITE_RECIPES = [
  { id: 1, imageUrl: '', difficulty: 'easy', name: '두부 김치찌개', description: '알레르기 걱정 없는 담백한 한 그릇', time: 20, serves: 2, likes: 34, safetyType: 'safe', safetyTitle: '안전', safetyDesc: '제한 재료 없음' },
  { id: 2, imageUrl: '', difficulty: 'normal', name: '채소 비빔밥', description: '제철 채소로 만드는 든든한 한 끼', time: 25, serves: 1, likes: 21, safetyType: 'replacement', safetyTitle: 'AI 대체 제안', safetyDesc: '대체 재료로 안전하게 즐기세요' },
  { id: 3, imageUrl: '', difficulty: 'hard', name: '두유 크림 파스타', description: '유제품 없이 즐기는 크림 파스타', time: 30, serves: 2, likes: 45, safetyType: 'safe', safetyTitle: '안전', safetyDesc: '제한 재료 없음' },
];

const POPULAR_RECIPES = [
  { id: 4, imageUrl: '', difficulty: 'easy', name: '연어 포케볼', description: '신선한 채소와 연어로 만든 건강한 한 끼', time: 15, serves: 1, likes: 58 },
  { id: 5, imageUrl: '', difficulty: 'normal', name: '버섯 크림 리소토', description: '유제품 대체재로 만든 고소한 리소토', time: 35, serves: 2, likes: 42 },
  { id: 6, imageUrl: '', difficulty: 'easy', name: '견과류 없는 그래놀라볼', description: '땅콩 알레르기도 안심하고 즐기는 아침', time: 10, serves: 1, likes: 67 },
  { id: 7, imageUrl: '', difficulty: 'hard', name: '글루텐프리 두부 스테이크', description: '밀가루 없이 든든하게 즐기는 한 끼', time: 25, serves: 2, likes: 33 },
];

const VEGAN_TABS = ['전체', '비건', '락토', '오보', '페스코'];
const VEGAN_TABS_MORE = ['일반', '플렉시테리언', '폴로', '락토-오보'];

const VEGAN_RECIPES = [
  { id: 8, imageUrl: '', difficulty: 'easy', name: '두부 스크램블', description: '달걀 없이 즐기는 아침 식사', time: 15, serves: 1, likes: 29 },
  { id: 9, imageUrl: '', difficulty: 'normal', name: '병아리콩 커리', description: '고소하고 든든한 비건 커리', time: 30, serves: 2, likes: 38 },
  { id: 10, imageUrl: '', difficulty: 'easy', name: '아보카도 토스트', description: '간단하게 즐기는 비건 브런치', time: 10, serves: 1, likes: 51 },
];

function HomePage() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const [favoriteIds, setFavoriteIds] = useState(FAVORITE_RECIPES.map((r) => r.id));
  const displayedFavorites = FAVORITE_RECIPES.filter((r) => favoriteIds.includes(r.id));
  const handleUnfavorite = (id) => {
    setFavoriteIds((prev) => prev.filter((favId) => favId !== id));
  };

  const [activeVeganTab, setActiveVeganTab] = useState('전체');
  const [showAllVeganTabs, setShowAllVeganTabs] = useState(false);
  const [veganLoading, setVeganLoading] = useState(false);

  const handleVeganTabClick = (tab) => {
    setActiveVeganTab(tab);
    setVeganLoading(true);
    setTimeout(() => setVeganLoading(false), 600); // TODO: 실제 API 연동 시 교체
  };

  return (
    <div className={styles['home-page']}>
      <section className={styles['home-hero']}>
        <div className={`container ${styles['home-hero__inner']}`}>
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
          </div>

          <div className={styles['home-hero__fixed-area']}>
            <div className={styles['home-hero__search-bar']}>
              <input
                type="text"
                placeholder="재료나 메뉴를 검색해보세요"
                className={styles['home-hero__search-input']}
              />
              <button className={`text-button-m ${styles['home-hero__search-btn']}`}>검색</button>
            </div>

            <div className={styles['home-hero__chips-cta']}>
              <div className={styles['home-hero__chips']}>
                <span className={styles['home-hero__chip']}>
                  <span className="material-symbols-outlined">check</span>비건
                </span>
                <span className={styles['home-hero__chip']}>
                  <span className="material-symbols-outlined">check</span>락토
                </span>
                <span className={styles['home-hero__chip']}>
                  <span className="material-symbols-outlined">check</span>오보
                </span>
                <span className={`${styles['home-hero__chip']} ${styles['home-hero__chip--warning']}`}>
                  <span className="material-symbols-outlined">warning</span>우유 제외
                </span>
                <span className={`${styles['home-hero__chip']} ${styles['home-hero__chip--warning']}`}>
                  <span className="material-symbols-outlined">warning</span>난류 제외
                </span>
                <span className={`${styles['home-hero__chip']} ${styles['home-hero__chip--warning']}`}>
                  <span className="material-symbols-outlined">warning</span>땅콩 제외
                </span>
              </div>

              <button className={`text-button-l ${styles['home-hero__cta-btn']}`}>맞춤 레시피 찾기</button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles['home-process']}>
        <div className={`container ${styles['home-process__inner']}`}>
          {STEPS.map((step, index) => (
            <Fragment key={index}>
              <div className={styles['home-process__step']}>
                <div className={styles['home-process__icon-circle']}>
                  <span className={`material-symbols-outlined ${styles['home-process__icon']}`}>
                    {step.icon}
                  </span>
                </div>
                <div className={styles['home-process__text']}>
                  <p className={styles['home-process__title']}>{step.title}</p>
                  <p className={styles['home-process__desc']}>{step.desc}</p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <span className={`material-symbols-outlined ${styles['home-process__arrow']}`}>
                  arrow_forward
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </section>

      <section className={styles['home-favorites']}>
        <div className={`container ${styles['home-favorites__inner']}`}>
          <div className={styles['home-favorites__header']}>
            <h2 className={styles['home-favorites__title']}>즐겨찾는 레시피</h2>
            <Link to="/favorite" className={styles['home-favorites__more']}>더보기</Link>
          </div>
          <div className={styles['home-favorites__grid']}>
            {displayedFavorites.map((recipe) => (
              <FavoriteRecipeCard
                key={recipe.id}
                imageUrl={recipe.imageUrl}
                difficulty={recipe.difficulty}
                name={recipe.name}
                description={recipe.description}
                time={recipe.time}
                serves={recipe.serves}
                likes={recipe.likes}
                safetyType={recipe.safetyType}
                safetyTitle={recipe.safetyTitle}
                safetyDesc={recipe.safetyDesc}
                onClick={() => navigate(`/recipes/${recipe.id}`)}
                onFavoriteClick={() => handleUnfavorite(recipe.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className={styles['home-popular']}>
        <div className={`container ${styles['home-popular__inner']}`}>
          <h2 className={styles['home-popular__title']}>인기 레시피</h2>
          <div className={styles['home-popular__grid']}>
            {POPULAR_RECIPES.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                imageUrl={recipe.imageUrl}
                difficulty={recipe.difficulty}
                name={recipe.name}
                description={recipe.description}
                time={recipe.time}
                serves={recipe.serves}
                likes={recipe.likes}
                onClick={() => navigate(`/recipes/${recipe.id}`)}
              />
            ))}
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
              {VEGAN_RECIPES.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  imageUrl={recipe.imageUrl}
                  difficulty={recipe.difficulty}
                  name={recipe.name}
                  description={recipe.description}
                  time={recipe.time}
                  serves={recipe.serves}
                  likes={recipe.likes}
                  onClick={() => navigate(`/recipes/${recipe.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default HomePage;