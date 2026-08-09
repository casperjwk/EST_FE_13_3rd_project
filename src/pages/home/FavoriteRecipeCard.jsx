import Badge from '../../components/common/Badge';
import styles from './FavoriteRecipeCard.module.css';

function FavoriteRecipeCard({
  imageUrl,
  difficulty,
  name,
  description,
  time,
  serves,
  likes,
  safetyType = 'safe',
  safetyTitle,
  safetyDesc,
  onClick,
}) {
  const difficultyClassName = {
    easy: styles.easy,
    normal: styles.normal,
    hard: styles.hard,
  }[difficulty];

  const difficultyLabel = {
    easy: '쉬움',
    normal: '보통',
    hard: '어려움',
  }[difficulty];

  return (
    <div className={styles.cardBorder}>
      <div className={styles.cardImageArea}>
        <img src={imageUrl} alt={name} className={styles.cardImage} onClick={onClick} />
        <span className={`${styles.cardDifficulty} ${difficultyClassName} text-xs`}>{difficultyLabel}</span>
        <button className={`${styles.cardHeart} material-symbols-outlined`} aria-label="좋아요">
          favorite
        </button>
      </div>
      <div className={styles.cardTextArea} onClick={onClick}>
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
      </div>

      <div className={styles.safetyFooter}>
        <div className={styles.safetyText}>
          <span className={`${styles.safetyIcon} material-symbols-outlined`}>shopping_basket</span>
          <div>
            <p className={`${styles.safetyTitle} text-s`}>{safetyTitle}</p>
            <p className={`${styles.safetyDesc} text-xs`}>{safetyDesc}</p>
          </div>
        </div>
        <Badge type={safetyType} />
      </div>
    </div>
  );
}

export default FavoriteRecipeCard;