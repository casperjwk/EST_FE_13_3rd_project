import React, { useState, useEffect } from "react";
import styles from "./LoginPage.module.css";
import { supabase } from "../../lib/supabase";

/* 카카오 소셜 아이콘 컴포넌트 */
const IconKakao = ({ size = 18, color = "var(--black-1)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block" }}>
    <path d="M12 3C6.477 3 2 6.477 2 10.765c0 2.766 1.83 5.19 4.608 6.577-.202.738-.732 2.673-.838 3.084-.133.518.19.512.398.374.164-.11 2.61-1.77 3.666-2.488.718.106 1.458.163 2.166.163 5.523 0 10-3.477 10-7.765C22 6.477 17.523 3 12 3z" />
  </svg>
);

/* 네이버 소셜 아이콘 컴포넌트 */
const IconNaver = ({ size = 14, color = "var(--white-1)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block" }}>
    <path d="M16.273 12.845L7.376 0H0v24h7.727v-12.845L16.624 24H24V0h-7.727v12.845z" />
  </svg>
);

export default function LoginPage({ onGoToSignup, onLoginSuccess }) {
  /* 입력값 및 오류 메시지 상태 관리 */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /* 소셜 로그인 인증 콜백 처리 및 프로필 동기화 */
  useEffect(() => {
    const handleSocialAuthCallback = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session?.user) return;

        const user = session.user;
        const rawMetaData = user.user_metadata || {};

        const userEmail = user.email || "";
        const nickname =
          rawMetaData.full_name || rawMetaData.name || rawMetaData.nickname || userEmail.split("@")[0] || "사용자";
        const profileImage = rawMetaData.avatar_url || rawMetaData.profile_image || "";

        const { data: existingUser } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();

        if (!existingUser) {
          const { error: insertError } = await supabase.from("profiles").insert({
            id: user.id,
            nickname: nickname,
            profile_image_url: profileImage,
            created_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error("profiles 저장 실패:", insertError.message);
          }
        }

        localStorage.setItem("userEmail", userEmail);
        localStorage.setItem("isLoggedIn", "true");

        if (onLoginSuccess) {
          onLoginSuccess(userEmail);
        }
      } catch (err) {
        console.error("소셜 로그인 DB 동기화 오류:", err);
      }
    };

    handleSocialAuthCallback();
  }, [onLoginSuccess]);

  /* 회원가입 페이지 이동 핸들러 */
  const handleSignupClick = () => {
    if (onGoToSignup) {
      onGoToSignup();
    } else {
      window.location.href = "/signup";
    }
  };

  /* 일반 이메일 로그인 처리 핸들러 */
  const handleLogin = async e => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMessage("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        console.error("로그인 실패:", error.message);
        setErrorMessage("아이디 또는 비밀번호가 잘못되었습니다.");
        return;
      }

      setErrorMessage("");
      if (keepLoggedIn) {
        localStorage.setItem("keepLoggedIn", "true");
      } else {
        localStorage.removeItem("keepLoggedIn");
      }

      const loggedInEmail = data.user?.email || email;
      localStorage.setItem("userEmail", loggedInEmail);
      localStorage.setItem("isLoggedIn", "true");

      if (onLoginSuccess) {
        onLoginSuccess(loggedInEmail);
      }
      window.location.href = "/";
    } catch (err) {
      console.error("로그인 예외 발생:", err);
      setErrorMessage("로그인 중 오류가 발생했습니다.");
    }
  };

  /* 소셜 로그인 처리 핸들러 (카카오 / 네이버) */
  const handleSocialLogin = async provider => {
    setErrorMessage("");

    if (keepLoggedIn) {
      localStorage.setItem("keepLoggedIn", "true");
    }

    if (provider === "kakao") {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "kakao",
          options: {
            redirectTo: "http://localhost:5173",
            queryParams: {
              prompt: "login",
            },
          },
        });

        if (error) {
          console.error("카카오 로그인 실패:", error.message);
          setErrorMessage("카카오 로그인 진행 중 오류가 발생했습니다.");
        }
      } catch (err) {
        console.error("카카오 로그인 예외 발생:", err);
      }
    } else if (provider === "naver") {
      const NAVER_CLIENT_ID = "B3cP_MJX21Js9nHAJGrH";

      /* 현재 접속 중인 환경의 주소를 동적으로 가져오도록 수정 */
      const currentOrigin = window.location.origin;
      const REDIRECT_URI = encodeURIComponent(currentOrigin);

      const STATE = Math.random().toString(36).substring(3);

      const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${STATE}`;

      window.location.href = naverAuthUrl;
    }
  };

  return (
    <div className={styles.outerWrapper} translate="no" lang="ko">
      <div className={styles.splitCard}>
        {/* 좌측 안내 배너 영역 */}
        <div className={styles.leftBanner}>
          <div>
            <h2 className={`text-subtitle-l ${styles.bannerTitle}`}>
              맛있는 맞춤 식단,
              <br />
              다시 시작해 볼까요?
            </h2>
            <p className={`text-s ${styles.bannerSub}`}>
              로그인하시면 설정해 두신 맞춤 식단 조건과 즐겨찾는
              <br />
              레시피를 바로 확인하실 수 있습니다.
            </p>
          </div>
          <div className={`text-xs ${styles.bannerCopyright}`}>© Han77ilab Platform. All rights reserved.</div>
        </div>

        {/* 우측 로그인 입력 폼 영역 */}
        <div className={styles.rightForm}>
          <div>
            {/* PC 버전 헤더 타이틀 */}
            <div className={styles.pcHeader}>
              <h3 className={`text-subtitle-l ${styles.formTitle}`}>로그인</h3>
              <p className={`text-s ${styles.formSubtitle}`}>한끼랩 서비스 이용을 위한 계정 정보 입력</p>
            </div>

            {/* 모바일 버전 헤더 타이틀 */}
            <div className={styles.mobileHeader}>
              <h2 className={`text-subtitle-l ${styles.mobileTitle}`}>
                맛있는 맞춤 식단,
                <br />
                다시 시작해 볼까요?
              </h2>
              <p className={`text-s ${styles.mobileSub}`}>Han77ilab 로그인</p>
            </div>

            {/* 로그인 폼 입력 그룹 */}
            <form onSubmit={handleLogin} className={styles.formGroup}>
              {/* 이메일 입력 필드 */}
              <div style={{ marginBottom: "16px" }}>
                <label className={`text-button-s ${styles.label}`}>이메일(아이디)</label>
                <input
                  type="email"
                  className={`text-s ${styles.input}`}
                  placeholder="example@email.com"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                />
              </div>

              {/* 비밀번호 입력 필드 */}
              <div style={{ marginBottom: "16px" }}>
                <label className={`text-button-s ${styles.label}`}>비밀번호</label>
                <input
                  type="password"
                  className={`text-s ${styles.input}`}
                  placeholder="영문, 숫자 포함 8자 입력"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                />
              </div>

              {/* 에러 메시지 노출 영역 */}
              {errorMessage && (
                <div
                  style={{
                    color: "var(--danger)",
                    fontSize: "var(--xsmall)",
                    marginTop: "-8px",
                    marginBottom: "12px",
                    fontWeight: "500",
                  }}
                >
                  {errorMessage}
                </div>
              )}

              {/* 로그인 상태 유지 및 비밀번호 찾기 옵션 */}
              <div className={`text-s ${styles.optionsRow}`}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={keepLoggedIn}
                    onChange={e => setKeepLoggedIn(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span>로그인 상태 유지</span>
                </label>
                <span className={`${styles.pcHeader} ${styles.findPasswordLink}`}>비밀번호 찾기</span>
              </div>

              {/* 제출 버튼 */}
              <button type="submit" className={`text-button-m ${styles.btnPrimaryLarge}`}>
                로그인
              </button>
            </form>

            {/* 모바일 환경 하단 푸터 링크 */}
            <div className={`text-s ${styles.mobileFooter}`}>
              <span>아이디 찾기</span> &nbsp;|&nbsp;
              <span>비밀번호 찾기</span> &nbsp;|&nbsp;
              <span onClick={handleSignupClick} className={styles.linkHighlight}>
                회원가입
              </span>
            </div>

            {/* 구분선 컨테이너 */}
            <div className={styles.dividerContainer}>
              <div className={styles.dividerLine} />
              <span className={`text-xs ${styles.dividerText}`}>또는 소셜 계정으로 로그인</span>
              <div className={styles.dividerLine} />
            </div>

            {/* 소셜 로그인 버튼 그리드 */}
            <div className={styles.socialGrid}>
              <button
                type="button"
                className={`text-button-s ${styles.btnKakao}`}
                onClick={() => handleSocialLogin("kakao")}
              >
                <IconKakao size={18} />
                <span>카카오로 1초 만에 시작</span>
              </button>
              <button
                type="button"
                className={`text-button-s ${styles.btnNaver}`}
                onClick={() => handleSocialLogin("naver")}
              >
                <IconNaver size={14} />
                <span>네이버로 시작하기</span>
              </button>
            </div>

            {/* PC 환경 하단 회원가입 유도 영역 */}
            <div className={`text-s ${styles.pcFooter}`}>
              아직 회원이 아니신가요?
              <span onClick={handleSignupClick} className={styles.linkHighlight}>
                회원가입하기
              </span>
            </div>

            {/* 모바일 환경 저작권 표시 */}
            <div className={`text-xs ${styles.mobileCopyright}`}>© Han77ilabPlatform. All rights reserved.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
