import React, { useState, useEffect } from "react";
import logoImg from "../../assets/logo.svg";
import DashboardSection from "./DashboardSection";
import UserDietSection from "./UserDietSection";
import SystemSettingsSection from "./SystemSettingsSection";
import styles from "./AdminPage.module.css";
import { supabase } from "../../lib/supabase";

/* ----------------------------------------------------
    사이드바 전용 단색 라인 SVG 아이콘 모음
---------------------------------------------------- */
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
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

/* ----------------------------------------------------
   AdminPage 메인 컴포넌트
---------------------------------------------------- */
const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAuthorized, setIsAuthorized] = useState(false); // 권한 체크 상태
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태

  // 📌 진입 시 로그인 및 관리자 권한 검증 가드 로직
  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // 1. 로그인이 아예 안 되어 있다면 로그인 페이지로 튕김
        if (!session) {
          alert("로그인이 필요한 페이지입니다.");
          window.location.href = "/login";
          return;
        }

        // 2. (선택) 로컬 스토리지 테스트 로그인이나 특정 관리자 이메일 검증
        // 만약 테스트 계정으로 로그인한 경우라면 통과시켜 줌
        const userEmail = session.user.email;

        // 관리자로 인정할 조건 (예: 특정 관리자 이메일이거나 수동 테스트 플래그 등)
        // 팀 프로젝트 시연을 위해 본인 계정이나 테스트 계정을 여기에 추가할 수 있습니다.
        const isAdmin = userEmail === "test@han77ilab.com" || userEmail?.includes("admin");

        // 만약 DB의 profiles 테이블에서 role 컬럼을 관리하신다면 아래처럼 조회해서 체크할 수도 있습니다.
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();

        // 관리자 권한 통과 조건 (DB에 admin 권한이 있거나, 위의 이메일 조건에 맞을 때)
        // 시연을 원활하게 하기 위해 현재는 로그인된 유저라면 일단 통과시키되,
        // 엄격하게 하려면 profile의 관리자 여부를 체크하도록 수정할 수 있습니다.
        if (session) {
          setIsAuthorized(true);
        } else {
          alert("관리자 권한이 없습니다.");
          window.location.href = "/";
        }
      } catch (err) {
        console.error("권한 검증 오류:", err);
        window.location.href = "/login";
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAuth();
  }, []);

  // 로딩 중일 때는 빈 화면이나 로딩바를 보여주어 깜빡임 방지
  if (isLoading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>권한 확인 중...</div>;
  }

  // 권한이 없으면 아예 화면을 그려주지 않음
  if (!isAuthorized) {
    return null;
  }

  return (
    <div className={styles.outerWrapper}>
      {/* 1. 좌측 사이드바 */}
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <a href="/" className={styles.logoLink}>
            <img src={logoImg} alt="한끼랩 로고" className={styles.logoImage} />
          </a>
        </div>

        <nav className={styles.navMenu}>
          {/* GENERAL 카테고리 */}
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

          {/* SYSTEM 카테고리 */}
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

        {/* 하단 관리자 프로필 */}
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

      {/* 2. 우측 메인 콘텐츠 */}
      <main className={styles.mainContent}>
        {activeTab === "dashboard" && <DashboardSection />}
        {activeTab === "userDiet" && <UserDietSection />}
        {activeTab === "settings" && <SystemSettingsSection />}
      </main>
    </div>
  );
};

export default AdminPage;
