import React, { useState, useEffect } from "react";
import logoImg from "../../assets/logo.svg";
import DashboardSection from "./DashboardSection";
import UserDietSection from "./UserDietSection";
import SystemSettingsSection from "./SystemSettingsSection";
import styles from "./AdminPage.module.css";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext"; // 전역 인증 훅 import

/* 사이드바 메뉴 및 아바타 아이콘 컴포넌트 */
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
  /* 상태 관리 변수 선언 */
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentProfile, setCurrentProfile] = useState(null);

  /* 전역 인증 정보 및 로딩 상태 연동 (하드코딩 제거) */
  const { user, loading: authLoading } = useAuth();

  /* 관리자 권한 검증 및 최신 프로필 데이터 조회 로직 */
  useEffect(() => {
    /* 1. 세션 로딩 완료 대기 */
    if (authLoading) return;

    /* 2. 로그인된 유저가 없을 경우 예외 처리 */
    if (!user) {
      alert("로그인이 필요한 페이지입니다.");
      window.location.href = "/login";
      return;
    }

    const checkAdminAuth = async () => {
      try {
        /* 관리자 권한 확인 */
        const { data: adminData, error: adminError } = await supabase
          .from("admins")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (adminError) throw adminError;

        if (adminData) {
          setIsAuthorized(true);
        } else {
          alert("접근 권한이 없습니다. 관리자만 접근할 수 있습니다.");
          window.location.href = "/";
          return;
        }

        /* Supabase에서 본인 ID로 프로필 데이터 단건 조회 */
        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

        if (profileData) {
          setCurrentProfile(profileData);
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
  }, [user, authLoading]);

  /* 프로필 정보 안전하게 추출 (컬럼명 호환성 보장) 및 최신 데이터 반영 */
  const profileImageUrl =
    currentProfile?.profile_image_url || currentProfile?.avatar_url || currentProfile?.profile_img || "";

  const nickname = currentProfile?.nickname || "관리자";
  const userEmail = user?.email || "";

  /* 로딩 중이거나 권한이 없을 때의 화면 처리 */
  if (isLoading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>보안 권한 확인 중...</div>;
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className={styles.outerWrapper}>
      {/* 사이드바 영역 */}
      <aside className={styles.sidebar}>
        {/* 로고 영역 */}
        <div className={styles.logoArea}>
          <a href="/" className={styles.logoLink}>
            <img src={logoImg} alt="한끼랩 로고" className={styles.logoImage} />
          </a>
        </div>

        {/* 네비게이션 메뉴 영역 */}
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

        {/* 하단 프로필 영역 */}
        <div className={styles.profileArea}>
          <div
            className={styles.avatar}
            style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt="관리자 프로필"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <UserAvatarIcon />
            )}
          </div>
          <div>
            <p className={styles.userName} style={{ marginBottom: "6px" }}>
              {nickname}
            </p>
            <p className={styles.userRole}>{userEmail}</p>
          </div>
        </div>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className={styles.mainContent}>
        {activeTab === "dashboard" && <DashboardSection />}
        {activeTab === "userDiet" && <UserDietSection />}
        {activeTab === "settings" && <SystemSettingsSection />}
      </main>
    </div>
  );
};

export default AdminPage;
