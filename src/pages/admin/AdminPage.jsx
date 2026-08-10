import React, { useState, useEffect } from "react";
import logoImg from "../../assets/logo.svg";
import DashboardSection from "./DashboardSection";
import UserDietSection from "./UserDietSection";
import SystemSettingsSection from "./SystemSettingsSection";
import styles from "./AdminPage.module.css";

const DashboardIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const UserDietIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const UserAvatarIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminAuth = () => {
      try {
        // 로컬 스토리지에 저장된 userEmail을 직접 읽어서 관리자 여부 확인
        const userEmail = localStorage.getItem("userEmail") || "";
        const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

        console.log("현재 로컬스토리지 인증 이메일:", userEmail);

        if (!isLoggedIn || !userEmail) {
          alert("로그인이 필요한 페이지입니다.");
          window.location.href = "/login";
          return;
        }

        const allowedAdminEmails = ["test@han77ilab.com", "admin@han77ilab.com"];
        if (allowedAdminEmails.includes(userEmail.trim())) {
          setIsAuthorized(true);
        } else {
          alert("접근 권한이 없습니다.");
          window.location.href = "/";
        }
      } catch (err) {
        console.error("권한 검증 오류:", err);
        alert("접근 권한이 없습니다.");
        window.location.href = "/";
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAuth();
  }, []);

  if (isLoading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>보안 권한 확인 중...</div>;
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className={styles.outerWrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <a href="/" className={styles.logoLink}>
            <img src={logoImg} alt="한끼랩 로고" className={styles.logoImage} />
          </a>
        </div>

        <nav className={styles.navMenu}>
          <div className={styles.category}>
            <span className={styles.categoryTitle}>GENERAL</span>
            <button
              className={`${styles.navItem} ${activeTab === "dashboard" ? styles.active : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              <DashboardIcon />
              <span>대시보드</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === "userDiet" ? styles.active : ""}`}
              onClick={() => setActiveTab("userDiet")}
            >
              <UserDietIcon />
              <span>회원 식단 관리</span>
            </button>
          </div>

          <div className={styles.category}>
            <span className={styles.categoryTitle}>SYSTEM</span>
            <button
              className={`${styles.navItem} ${activeTab === "settings" ? styles.active : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <SettingsIcon />
              <span>시스템 설정</span>
            </button>
          </div>
        </nav>

        <div className={styles.profileArea}>
          <div className={styles.avatar}>
            <UserAvatarIcon />
          </div>
          <div>
            <p className={styles.userName}>관리자</p>
            <p className={styles.userRole}>super_admin</p>
          </div>
        </div>
      </aside>

      <main className={styles.mainContent}>
        {activeTab === "dashboard" && <DashboardSection />}
        {activeTab === "userDiet" && <UserDietSection />}
        {activeTab === "settings" && <SystemSettingsSection />}
      </main>
    </div>
  );
};

export default AdminPage;
