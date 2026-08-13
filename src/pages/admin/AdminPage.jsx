import React, { useState, useEffect } from "react";
import logoImg from "../../assets/logo.svg";
import DashboardSection from "./DashboardSection";
import UserDietSection from "./UserDietSection";
import SystemSettingsSection from "./SystemSettingsSection";
import styles from "./AdminPage.module.css";
import { supabase } from "../../lib/supabase";

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

// 레시피 추가 페이지로 이동할 때 쓸 플러스 아이콘
const PlusIcon = () => (
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
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
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
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
    const checkAdminAuth = async () => {
      try {
        // 1. Supabase 현재 로그인 세션/유저 정보 확인
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          alert("로그인이 필요한 페이지입니다.");
          window.location.href = "/login";
          return;
        }

        console.log("현재 로그인한 유저 ID:", user.id);

        // 2. Supabase admins 테이블에서 현재 유저의 ID가 등록되어 있는지 조회
        const { data: adminData, error: adminError } = await supabase
          .from("admins")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (adminError) throw adminError;

        if (adminData) {
          // admins 테이블에 존재함 -> 관리자 승인
          setIsAuthorized(true);
        } else {
          // 존재하지 않음 -> 권한 없음
          alert("접근 권한이 없습니다. 관리자만 접근할 수 있습니다.");
          window.location.href = "/";
        }
      } catch (err) {
        console.error("관리자 권한 검증 오류:", err);
        alert("권한 확인 중 오류가 발생했습니다.");
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

            {/* /create 페이지로 이동하는 레시피 추가 버튼 */}
            <button
              className={styles.navItem}
              onClick={() => {
                window.location.href = "/create";
              }}
            >
              <PlusIcon />
              <span>레시피 추가</span>
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
