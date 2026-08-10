import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo.svg';
import styles from './common.module.css';

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const isLoggedIn = !!user;

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    signOut();
    closeMenu();
  };

  return (
    <header className={styles['common-header']}>
      <div className={`container ${styles['common-header__inner']}`}>
        <Link to="/" className={styles['common-header__logo']} onClick={closeMenu}>
          <img src={logoImg} alt="한끼랩" className={styles['common-header__logo-img']} />
        </Link>

        <nav className={styles['common-header__nav']}>
          <Link to="/" className={`${styles['common-header__nav-link']} text-s`}>홈</Link>
          <Link to="/recipes" className={`${styles['common-header__nav-link']} text-s`}>레시피</Link>
          <Link to="/mypage" className={`${styles['common-header__nav-link']} text-s`}>마이페이지</Link>
        </nav>

        <div className={styles['common-header__auth-area']}>
          {isLoggedIn ? (
            <Link to="/mypage" className={styles['common-header__profile-circle']}></Link>
          ) : (
            <>
              <Link to="/login" className={`${styles['common-header__login-btn']} text-button-s`}>로그인</Link>
              <Link to="/signup" className={`${styles['common-header__signup-btn']} text-button-s`}>회원가입</Link>
            </>
          )}
        </div>

        <button
          className={styles['common-header__hamburger-btn']}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴 열기"
        >
          <span className={`material-symbols-outlined ${styles['common-header__hamburger-icon']}`}>menu</span>
        </button>
      </div>

      {menuOpen && (
        <div className={styles['common-header__mobile-menu']}>
          {isLoggedIn ? (
            <>
              <div className={styles['common-header__mobile-profile']}>
                <div className={styles['common-header__profile-circle']}></div>
                <span className="text-s">{user.email}</span>
              </div>
              <Link to="/" className={`${styles['common-header__mobile-link']} text-s`} onClick={closeMenu}>홈</Link>
              <Link to="/recipes" className={`${styles['common-header__mobile-link']} text-s`} onClick={closeMenu}>레시피</Link>
              <Link to="/mypage" className={`${styles['common-header__mobile-link']} text-s`} onClick={closeMenu}>마이페이지</Link>
              <Link to="/favorite" className={`${styles['common-header__mobile-link']} text-s`} onClick={closeMenu}>즐겨찾기</Link>
              <button
                className={`${styles['common-header__logout-btn']} text-s`}
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/" className={`${styles['common-header__mobile-link']} text-s`} onClick={closeMenu}>홈</Link>
              <Link to="/recipes" className={`${styles['common-header__mobile-link']} text-s`} onClick={closeMenu}>레시피</Link>
              <Link to="/mypage" className={`${styles['common-header__mobile-link']} text-s`} onClick={closeMenu}>마이페이지</Link>
              <div className={styles['common-header__mobile-auth-btns']}>
                <Link to="/login" className={`${styles['common-header__login-btn']} text-button-s`} onClick={closeMenu}>로그인</Link>
                <Link to="/signup" className={`${styles['common-header__signup-btn']} text-button-s`} onClick={closeMenu}>회원가입</Link>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export default Header;