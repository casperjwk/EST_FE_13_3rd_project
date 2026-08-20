import React, { useState, useEffect } from "react";
import styles from "./UserDietSection.module.css";
import { supabase } from "../../lib/supabase";

/* 단색 선 SVG 아이콘 모음 */
const UsersIcon = () => (
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

const PercentIcon = () => (
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
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

const LeafIcon = () => (
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
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.4 19 2c1 2 2 4.1 2 9 0 4.5-4 9-10 9z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);

const BookIcon = () => (
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
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const SparklesIcon = () => (
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
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z" />
  </svg>
);

const AlertTriangleIcon = () => (
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
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const HeartIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const UserAvatarIcon = () => (
  <svg
    width="28"
    height="28"
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

const UserDietSection = () => {
  /* 상태 관리 변수 선언 */
  const [stats, setStats] = useState({
    totalUsers: 0,
    allergyRatio: 0,
    veganUsers: 0,
    totalRecipes: 0,
    monthlyAiSearches: 0,
  });
  const [userInfo, setUserInfo] = useState({
    name: "로딩 중...",
    status: "정상 회원",
    email: "",
    joinDate: "",
    profileImageUrl: "",
    favoritesCount: 0,
    allergies: [],
    veganType: { name: "설정되지 않음", status: "미적용", description: "지정된 비건 식단이 없습니다." },
    appliedConditions: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  /* Supabase 데이터 연동 및 통계 계산 로직 (사이드바와 동일하게 이메일 기준으로 통일) */
  useEffect(() => {
    const fetchAdminDietData = async () => {
      try {
        /* 현재 로그인된 인증 유저 확인 */
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        let userEmail = authUser?.email || "test@han77ilab.com";

        /* 이메일을 기준으로 profiles 테이블에서 내 프로필 단건 조회 */
        const { data: profileData } = await supabase.from("profiles").select("*").eq("email", userEmail).maybeSingle();

        const targetProfile = profileData || {};
        let userId = targetProfile.id || authUser?.id;
        const formattedJoinDate = targetProfile.created_at ? targetProfile.created_at.split("T")[0] : "2026-00-00";

        /* 비건 유형 정보 조회 */
        let veganInfo = {
          name: "일반 식단 (지정 안 함)",
          status: "미적용",
          description: "선택된 비건 식단이 없습니다.",
        };
        if (targetProfile.vegan_type_id) {
          const { data: veganTypeData } = await supabase
            .from("vegan_types")
            .select("name, description")
            .eq("id", targetProfile.vegan_type_id)
            .maybeSingle();
          if (veganTypeData) {
            veganInfo = {
              name: veganTypeData.name,
              status: "현재 적용 중",
              description: veganTypeData.description || "가이드 적용 중",
            };
          }
        }

        /* 유저 알레르기 정보 조회 */
        let allergyNames = [];
        if (userId) {
          const { data: userAllergiesData } = await supabase
            .from("user_allergies")
            .select("allergen_id")
            .eq("user_id", userId);
          if (userAllergiesData?.length > 0) {
            const allergenIds = userAllergiesData.map(item => item.allergen_id);
            const { data: allergensData } = await supabase.from("allergens").select("name").in("id", allergenIds);
            if (allergensData) allergyNames = allergensData.map(a => a.name);
          }
        }

        const appliedConditions = [...allergyNames.map(name => ({ text: `${name} 제외`, type: "danger" }))];
        if (targetProfile.vegan_type_id) appliedConditions.push({ text: `${veganInfo.name} 가이드`, type: "primary" });

        /* 통계 데이터 집계 */
        const { count: totalUsersCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
        const { count: veganUsersCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .not("vegan_type_id", "is", null);
        const { count: recipesCount } = await supabase.from("recipes").select("*", { count: "exact", head: true });

        const currentUsers = totalUsersCount || 0;
        const currentRecipes = recipesCount || 0;

        let allergyPercentage = 0;
        if (currentUsers > 0) {
          const { data: allergyData } = await supabase.from("user_allergies").select("user_id");
          if (allergyData) {
            const uniqueAllergyUsers = new Set(allergyData.map(item => item.user_id)).size;
            allergyPercentage = Math.round((uniqueAllergyUsers / currentUsers) * 100);
          }
        }

        setStats({
          totalUsers: currentUsers,
          allergyRatio: allergyPercentage,
          veganUsers: veganUsersCount || 0,
          totalRecipes: currentRecipes,
          monthlyAiSearches: currentRecipes * 12 + currentUsers * 15,
        });

        /* 즐겨찾기 개수 조회 */
        let favCount = 0;
        if (userId) {
          const { count: favoriteCount } = await supabase
            .from("favorites")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);
          favCount = favoriteCount || 0;
        }

        /* 프로필 이미지 URL 안전하게 추출 (사이드바와 동일한 컬럼명 우선순위 적용) */
        const resolvedProfileImg =
          targetProfile.profile_image_url || targetProfile.avatar_url || targetProfile.profile_img || "";

        /* 유저 정보 상태 업데이트 */
        setUserInfo({
          name: targetProfile.nickname || "한끼관리자",
          status: "정상 회원",
          email: userEmail,
          joinDate: formattedJoinDate,
          profileImageUrl: resolvedProfileImg,
          favoritesCount: favCount,
          allergies: allergyNames,
          veganType: veganInfo,
          appliedConditions:
            appliedConditions.length > 0 ? appliedConditions : [{ text: "적용된 조건 없음", type: "primary" }],
        });
      } catch (err) {
        console.error("데이터 로드 오류:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdminDietData();
  }, []);

  /* 상단 통계 카드 데이터 배열 */
  const statCards = [
    { id: "totalUsers", label: "전체 가입 회원", value: `${stats.totalUsers.toLocaleString()}명`, icon: <UsersIcon /> },
    { id: "allergyRatio", label: "알레르기 보유 비율", value: `${stats.allergyRatio}%`, icon: <PercentIcon /> },
    { id: "veganUsers", label: "비건 회원 수", value: `${stats.veganUsers.toLocaleString()}명`, icon: <LeafIcon /> },
    { id: "totalRecipes", label: "레시피 수", value: `${stats.totalRecipes.toLocaleString()}개`, icon: <BookIcon /> },
    {
      id: "monthlyAiSearches",
      label: "월간 AI 검색량",
      value: `${stats.monthlyAiSearches.toLocaleString()}회`,
      icon: <SparklesIcon />,
    },
  ];

  /* 로딩 상태 화면 처리 */
  if (isLoading) return <div style={{ padding: "40px", textAlign: "center" }}>데이터 불러오는 중...</div>;

  return (
    <div className={styles.container}>
      {/* 헤더 타이틀 영역 */}
      <div className={styles.header}>
        <h1 className={styles.title}>회원 맞춤 식단 DB 관리자</h1>
        <p className={styles.subtitle}>등록된 회원의 알레르기 및 비건 조건 데이터를 조회하고 수정합니다.</p>
      </div>

      {/* 통계 지표 그리드 영역 */}
      <div className={styles.statsGrid}>
        {statCards.map(item => (
          <div key={item.id} className={styles.statCard}>
            <span className={styles.statLabel}>{item.label}</span>
            <div className={styles.statValueWrapper}>
              <span className={styles.statValue}>{item.value}</span>
              <span className={styles.statIcon}>{item.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 식단 정보 및 회원 프로필 카드 */}
      <div className={styles.contentCard}>
        <h2 className={styles.cardTitle}>식단 정보</h2>
        <div className={styles.userProfileBox}>
          <div className={styles.userInfoGroup}>
            <div
              className={styles.userAvatar}
              style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {userInfo.profileImageUrl ? (
                <img
                  src={userInfo.profileImageUrl}
                  alt="회원 프로필"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <UserAvatarIcon />
              )}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userNameWrapper}>
                <span className={styles.userName}>{userInfo.name}</span>
                <span className={styles.statusBadge}>{userInfo.status}</span>
              </div>
              <p className={styles.userEmail}>{userInfo.email}</p>
              <p className={styles.userJoinDate}>가입일: {userInfo.joinDate}</p>
            </div>
          </div>
          <div className={styles.favoriteAction}>
            <div className={styles.favoriteCount}>{userInfo.favoritesCount}</div>
            <button className={styles.favoriteBtn}>
              <HeartIcon />
              <span>즐겨찾기 보기</span>
            </button>
          </div>
        </div>

        {/* 보유 알레르기 섹션 */}
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <h3 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>
              <AlertTriangleIcon />
              <span>보유 알레르기 (회원 직접 등록)</span>
            </h3>
            <span className={styles.itemCount}>총 {userInfo.allergies.length}개 항목 등록됨</span>
          </div>
          <div className={styles.tagList}>
            {userInfo.allergies.length > 0 ? (
              userInfo.allergies.map((allergy, idx) => (
                <span key={idx} className={styles.dangerTag}>
                  {allergy}
                </span>
              ))
            ) : (
              <span style={{ color: "var(--gray-3)", fontSize: "14px" }}>등록된 알레르기가 없습니다.</span>
            )}
          </div>
        </div>

        {/* 지정 비건 유형 섹션 */}
        <div className={styles.sectionBlock}>
          <h3 className={`${styles.sectionTitle} ${styles.primaryTitle}`}>
            <LeafIcon />
            <span>지정 비건 유형</span>
          </h3>
          <div className={styles.veganBox}>
            <div className={styles.veganIconBox}>
              <LeafIcon />
            </div>
            <div>
              <div className={styles.veganNameWrapper}>
                <span className={styles.veganName}>{userInfo.veganType.name}</span>
                <span className={styles.veganBadge}>{userInfo.veganType.status}</span>
              </div>
              <p className={styles.veganDesc}>{userInfo.veganType.description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDietSection;
