import styles from "./recipeCard.module.css";
import { Link } from "react-router";


/*
  카드모서리
    사진부분
      쉬움,보통,어려움
      좋아요 버튼
      사진
    음식 내용 부분
      음식이름
      음식 설명
      시간부분
        15분  인분  좋아요          한식중식
      ai분석 부분
*/
function RecipeCard({
  recipeId,
  imageUrl,
  difficulty,
  name,
  description,
  time,
  serves,
  likes,
  isFavorite = false,
  onFavoriteClick,
}) {

  const recipePath = `/recipes/${recipeId}`;

  const difficultyClassName = {
    easy: styles.easy,
    normal: styles.normal,
    hard: styles.hard,
  }[difficulty];


  const difficultyLabel = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
  }[difficulty];






  return(
    <div
      className={styles.cardBorder}
    >
      <div
        className={styles.cardImageArea}
      >
        <Link to={recipePath} className={styles.cardImageLink}>
          <img src={imageUrl} alt={name} className={styles.cardImage} />
        </Link>
        <span className={`${styles.cardDifficulty} ${difficultyClassName} text-xs`}>{difficultyLabel}</span>
      <button
        type="button"
        className={`${styles.cardHeart} ${isFavorite ? styles.cardHeartActive : ""} material-symbols-outlined`}
        aria-label={isFavorite ? "좋아요 취소" : "좋아요"}
        aria-pressed={isFavorite}
        onClick={onFavoriteClick}
      >
        favorite
      </button>
      </div>
      <div className={styles.cardTextArea}>
        <Link to={recipePath} className={styles.cardContentLink}>
        <h4
          className={`${styles.cardTitle} text-subtitle-s`}
        >
          {name}
        </h4>
        <p
          className={`${styles.cardDescription} text-s`}
        >
          {description}
        </p>

        <div
          className={styles.cardInfoArea}
        >
          <div className={styles.cardInfo}>
            <div className={styles.cardTPF}>
              <span className={`${styles.cardTimer} material-icons`}>timer</span>
              <p className="text-xs">{time}분</p>
            </div>
             <div className={styles.cardTPF}>
              <span className={`${styles.cardPerson} material-icons`}>person</span>
              <p className="text-xs">{serves}인분</p>
            </div>
            <div className={styles.cardTPF}>
              <span className={`${styles.cardFavorite} material-icons`}>favorite</span>
              <p className="text-xs">{likes}</p>
            </div>
          </div>
        </div>
      </Link>
        
        
        <div>
          <button
            type="button"
            className={styles.recipeStatusBox}
          >
            <div className={styles.recipeStatusLeft}>
              <span className="material-symbols-outlined" aria-hidden="true">
                auto_fix_high
              </span>

              <div>
                <p>AI 맞춤 분석</p>
                <span>알레르기·비건 조건 분석 준비중</span>
              </div>
            </div>

            <div className={styles.recipeStatusAction}>
              <span>준비중</span>
              <span className="material-symbols-outlined" aria-hidden="true">
                hourglass_empty
              </span>
            </div>
          </button>
        </div>
        
      </div>
    </div>
  )
}


export default RecipeCard;