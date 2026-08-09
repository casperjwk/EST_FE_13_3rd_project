import React, { useState } from "react";
import styles from "./LoginPage.module.css";
import { supabase } from "../../lib/supabase";

const IconKakao = ({ size = 18, color = "var(--black-1)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block" }}>
    <path d="M12 3C6.477 3 2 6.477 2 10.765c0 2.766 1.83 5.19 4.608 6.577-.202.738-.732 2.673-.838 3.084-.133.518.19.512.398.374.164-.11 2.61-1.77 3.666-2.488.718.106 1.458.163 2.166.163 5.523 0 10-3.477 10-7.765C22 6.477 17.523 3 12 3z" />
  </svg>
);

const IconNaver = ({ size = 14, color = "var(--white-1)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block" }}>
    <path d="M16.273 12.845L7.376 0H0v24h7.727v-12.845L16.624 24H24V0h-7.727v12.845z" />
  </svg>
);

export default function LoginPage({ onGoToSignup, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignupClick = () => {
    if (onGoToSignup) {
      onGoToSignup();
    } else {
      window.location.href = "/signup";
    }
  };

  const handleLogin = e => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMessage("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    if (email === "test@han77ilab.com" && password === "1234") {
      setErrorMessage("");
      if (onLoginSuccess) {
        onLoginSuccess(email);
      }
    } else {
      const goToSignup = window.confirm(
        "가입되지 않은 계정이거나 비밀번호가 일치하지 않습니다.\n회원가입 페이지로 이동하시겠습니까?",
      );

      if (goToSignup) {
        handleSignupClick();
      } else {
        setErrorMessage("아이디 또는 비밀번호가 잘못되었습니다.");
      }
    }
  };

  const handleSocialLogin = async provider => {
    setErrorMessage("");

    if (provider === "kakao") {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "kakao",
          options: {
            redirectTo: "http://localhost:5173",
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
      const REDIRECT_URI = encodeURIComponent("http://localhost:5173");
      const STATE = Math.random().toString(36).substring(3);

      const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${STATE}`;

      window.location.href = naverAuthUrl;
    }
  };

  return (
    <div className={styles.outerWrapper} translate="no" lang="ko">
      <div className={styles.splitCard}>
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

        <div className={styles.rightForm}>
          <div>
            <div className={styles.pcHeader}>
              <h3 className={`text-subtitle-l ${styles.formTitle}`}>로그인</h3>
              <p className={`text-s ${styles.formSubtitle}`}>한끼랩 서비스 이용을 위한 계정 정보 입력</p>
            </div>

            <div className={styles.mobileHeader}>
              <h2 className={`text-subtitle-l ${styles.mobileTitle}`}>
                맛있는 맞춤 식단,
                <br />
                다시 시작해 볼까요?
              </h2>
              <p className={`text-s ${styles.mobileSub}`}>Han77ilab 로그인</p>
            </div>

            <form onSubmit={handleLogin} className={styles.formGroup}>
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

              <button type="submit" className={`text-button-m ${styles.btnPrimaryLarge}`}>
                로그인
              </button>
            </form>

            <div className={`text-s ${styles.mobileFooter}`}>
              <span>아이디 찾기</span> &nbsp;|&nbsp;
              <span>비밀번호 찾기</span> &nbsp;|&nbsp;
              <span onClick={handleSignupClick} className={styles.linkHighlight}>
                회원가입
              </span>
            </div>

            <div className={styles.dividerContainer}>
              <div className={styles.dividerLine} />
              <span className={`text-xs ${styles.dividerText}`}>또는 소셜 계정으로 로그인</span>
              <div className={styles.dividerLine} />
            </div>

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

            <div className={`text-s ${styles.pcFooter}`}>
              아직 회원이 아니신가요?
              <span onClick={handleSignupClick} className={styles.linkHighlight}>
                회원가입하기
              </span>
            </div>

            <div className={`text-xs ${styles.mobileCopyright}`}>© Han77ilabPlatform. All rights reserved.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
