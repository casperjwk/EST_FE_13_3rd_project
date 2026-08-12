//데이터 로딩시 나오는 화면
import styles from "./recipeCard.module.css";

export default function RecipeCardSkeleton() {
  return (
    <div className={styles.cardBorder} aria-hidden="true">
      <div className={`${styles.cardImageArea} ${styles.skeletonImage}`}>
        <span className={`${styles.cardDifficulty} ${styles.skeletonBox}`} />
        <span className={`${styles.cardHeart} ${styles.skeletonCircle}`} />
      </div>

      <div className={styles.cardTextArea}>
        <div className={`${styles.skeletonBox} ${styles.skeletonTitle}`} />
        <div className={`${styles.skeletonBox} ${styles.skeletonDescription}`} />
        <div className={`${styles.skeletonBox} ${styles.skeletonDescriptionShort}`} />

        <div className={styles.cardInfoArea}>
          <div className={styles.cardInfo}>
            <div className={`${styles.skeletonBox} ${styles.skeletonMeta}`} />
            <div className={`${styles.skeletonBox} ${styles.skeletonMeta}`} />
            <div className={`${styles.skeletonBox} ${styles.skeletonMeta}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
