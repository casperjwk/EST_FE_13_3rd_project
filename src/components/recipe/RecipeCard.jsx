import styles from "./recipeCard.module.css";


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
  imageUrl,
  difficulty,
  name,
  description,
  time,
  serves,
  likes,
  onClick,
}){

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
        <img src={imageUrl} alt={name} className={styles.cardImage} onClick={onClick} />
        <span className={`${styles.cardDifficulty} ${difficultyClassName} text-xs`}>{difficultyLabel}</span>
        <button 
        className= {`${styles.cardHeart} material-symbols-outlined`} 
        aria-label="좋아요"
        >
          favorite
        </button>
      </div>
      <div className={styles.cardTextArea} onClick={onClick}>
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
        
        
        <div>
          <button
            type="button"
            className={styles.recipeStatusBox}
            onClick={onClick}
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