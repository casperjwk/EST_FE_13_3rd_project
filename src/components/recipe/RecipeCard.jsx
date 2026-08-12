import styles from "./recipeCard.module.css";
import { Link, useNavigate } from "react-router";

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
  status,
}) {
  const navigate = useNavigate();
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

  const STATUS_CONFIG = {
    safe: {
      title: "안전",
      description: "제한 재료 없음",
      action: "안전",
      icon: "check",
      className: styles.statusSafe,
    },
    replaceable: {
      title: "대체 가능",
      description: "대체 재료 추천 있음",
      action: "추천 보기",
      icon: "arrow_forward",
      className: styles.statusReplaceable,
    },
    warning: {
      title: "주의 감지",
      description: "알레르기 재료 포함",
      action: "상세 확인",
      icon: "arrow_forward",
      className: styles.statusWarning,
    },
    replaced: {
      title: "AI 대체 완료",
      description: "맞춤 대체 레시피 준비됨",
      action: "대체 레시피 보기",
      icon: "arrow_forward",
      className: styles.statusReplaced,
    },
  };

  const statusInfo = STATUS_CONFIG[status] ?? STATUS_CONFIG.safe;
  const handleStatusClick = () => {
    if (status !== "safe") {
      navigate(recipePath);
    }
  };

  return (
    <div className={styles.cardBorder}>
      <div className={styles.cardImageArea}>
        <Link to={recipePath} className={styles.cardImageLink}>
          <img src={imageUrl} alt={name} className={styles.cardImage} />
        </Link>
        <span className={`${styles.cardDifficulty} ${difficultyClassName} text-xs`}>
          {difficultyLabel}
        </span>
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
          <h4 className={`${styles.cardTitle} text-subtitle-s`}>{name}</h4>
          <p className={`${styles.cardDescription} text-s`}>{description}</p>

          <div className={styles.cardInfoArea}>
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
            className={`${styles.recipeStatusBox} ${statusInfo.className}`}
            onClick={handleStatusClick}
          >
            <div className={styles.recipeStatusLeft}>
              <span className="material-symbols-outlined" aria-hidden="true">
                auto_fix_high
              </span>

              <div>
                <p>{statusInfo.title}</p>
                <span>{statusInfo.description}</span>
              </div>
            </div>

            <div className={styles.recipeStatusAction}>
              <span>{statusInfo.action}</span>
              <span className="material-symbols-outlined" aria-hidden="true">
                {statusInfo.icon}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecipeCard;
