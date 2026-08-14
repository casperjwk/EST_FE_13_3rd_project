import { Link } from "react-router";
import styles from "./NotFoundPage.module.css";

function NotFoundPage() {
  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <span className={styles.code} aria-hidden="true">
          404
        </span>
        <h1 className={styles.title}>존재하지 않는 페이지입니다</h1>
        <Link className={`${styles.homeButton} text-button-m`} to="/">
          홈으로 가기
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_forward
          </span>
        </Link>
      </section>
    </main>
  );
}

export default NotFoundPage;
