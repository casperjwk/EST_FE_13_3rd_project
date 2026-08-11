import React, { useState } from "react";
import styles from "./SignupStep1.module.css";
import { supabase } from "../../lib/supabase";

const IconSprout = ({ size = 18, color = "var(--primary)" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20v-8" />
    <path d="M12 12C12 7 7 4 2 6c0 5 4 8 10 6z" />
    <path d="M12 12c0-5 5-8 10-6 0 5-4 8-10 6z" />
  </svg>
);

const IconSparkle = ({ size = 18, color = "var(--tag)" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

export default function SignupStep1({ onNext, onGoToLogin, initialData = {} }) {
  const [email, setEmail] = useState(initialData.email || "");
  const [password, setPassword] = useState(initialData.password || "");
  const [passwordConfirm, setPasswordConfirm] = useState(initialData.passwordConfirm || "");
  const [nickname, setNickname] = useState(initialData.nickname || "");
  const [agree, setAgree] = useState(initialData.agree || false);

  const [errors, setErrors] = useState({});

  // 이메일 형식 및 기본 입력값 검증
  const handleCheckEmailDuplicate = async () => {
    if (!email || !email.includes("@")) {
      setErrors(prev => ({ ...prev, email: "올바른 이메일 형식을 입력해 주세요. (@ 포함)" }));
      return;
    }
    // Step 1에서는 별도의 DB 조회 없이 형식만 통과시키고 최종 가입 시 Supabase Auth에서 중복 검사를 처리합니다.
    setErrors(prev => ({ ...prev, email: "" }));
    alert("사용 가능한 이메일 형식입니다.");
  };

  const validate = () => {
    const newErrors = {};

    if (!email || !email.includes("@")) {
      newErrors.email = "올바른 이메일 형식을 입력해 주세요. (@ 포함)";
    }

    if (!password || password.length < 8) {
      newErrors.password = "비밀번호는 영문, 숫자 포함 8자 이상이어야 합니다.";
    }

    if (password !== passwordConfirm) {
      newErrors.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    }

    if (!nickname.trim()) {
      newErrors.nickname = "사용하실 닉네임을 입력해 주세요.";
    }

    if (!agree) {
      newErrors.agree = "이용약관 및 개인정보 처리방침에 동의해 주세요.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (validate()) {
      if (onNext) {
        // Step 2로 데이터 전달 (이때 Supabase 가입은 절대 일어나지 않음)
        onNext({ email, password, nickname, agree });
      }
    }
  };

  return (
    <div className={styles.outerWrapper} translate="no" lang="ko">
      <div className={styles.splitCard}>
        {/* PC 전용 좌측 배너 */}
        <div className={styles.leftBanner}>
          <div>
            <h2 className={`text-subtitle-l ${styles.bannerTitle}`}>
              나만의 식이 맞춤
              <br />
              레시피 플랫폼,
              <br />
              <span style={{ color: "var(--primary)" }}>한끼랩</span>에 오신 것을
              <br />
              환영합니다!
            </h2>
            <p className={`text-s ${styles.bannerSub}`}>
              알레르기 정보부터 비건 식단까지,
              <br />
              회원님의 안전하고 즐거운 식생활을
              <br />
              위해 솔루션을 제공합니다.
            </p>

            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <div className={styles.iconCircle}>
                  <IconSprout size={18} color="var(--primary)" />
                </div>
                <span className={`text-s ${styles.featureText}`}>알레르기 유발 식재료 자동 스크리닝</span>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.iconCircle}>
                  <IconSparkle size={18} color="var(--tag)" />
                </div>
                <span className={`text-s ${styles.featureText}`}>실시간 AI 대체 식재료 추천</span>
              </div>
            </div>
          </div>
        </div>

        {/* 우측 회원가입 폼 */}
        <div className={styles.rightForm}>
          <div>
            <h3 className={`text-subtitle-l ${styles.formTitle}`}>기본 계정 정보를 입력해 주세요</h3>
            <p className={`text-s ${styles.formSubtitle}`}>서비스 이용을 위한 최소한의 정보입니다.</p>

            <form onSubmit={handleSubmit} className={styles.formGroup} noValidate>
              {/* 이메일 */}
              <div style={{ marginBottom: "16px" }}>
                <label className={`text-button-s ${styles.label}`}>이메일(아이디)</label>
                <div className={styles.inputGroup}>
                  <input
                    type="email"
                    className={`text-s ${styles.input} ${errors.email ? styles.inputError : ""}`}
                    placeholder="example@email.com"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: "" });
                    }}
                  />
                  <button
                    type="button"
                    className={`text-button-s ${styles.btnSecondary}`}
                    onClick={handleCheckEmailDuplicate}
                  >
                    중복확인
                  </button>
                </div>
                {errors.email && <span className={`text-xs ${styles.errorText}`}>{errors.email}</span>}
              </div>

              {/* 비밀번호 */}
              <div style={{ marginBottom: "16px" }}>
                <label className={`text-button-s ${styles.label}`}>비밀번호</label>
                <input
                  type="password"
                  className={`text-s ${styles.input} ${errors.password ? styles.inputError : ""}`}
                  placeholder="영문, 숫자 포함 8자 입력"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: "" });
                  }}
                />
                {errors.password && <span className={`text-xs ${styles.errorText}`}>{errors.password}</span>}
              </div>

              {/* 비밀번호 확인 */}
              <div style={{ marginBottom: "16px" }}>
                <label className={`text-button-s ${styles.label}`}>비밀번호 확인</label>
                <input
                  type="password"
                  className={`text-s ${styles.input} ${errors.passwordConfirm ? styles.inputError : ""}`}
                  placeholder="비밀번호를 한 번 더 입력해 주세요"
                  value={passwordConfirm}
                  onChange={e => {
                    setPasswordConfirm(e.target.value);
                    if (errors.passwordConfirm) setErrors({ ...errors, passwordConfirm: "" });
                  }}
                />
                {errors.passwordConfirm && (
                  <span className={`text-xs ${styles.errorText}`}>{errors.passwordConfirm}</span>
                )}
              </div>

              {/* 닉네임 */}
              <div style={{ marginBottom: "20px" }}>
                <label className={`text-button-s ${styles.label}`}>닉네임</label>
                <input
                  type="text"
                  className={`text-s ${styles.input} ${errors.nickname ? styles.inputError : ""}`}
                  placeholder="사용하실 닉네임을 입력하세요"
                  value={nickname}
                  onChange={e => {
                    setNickname(e.target.value);
                    if (errors.nickname) setErrors({ ...errors, nickname: "" });
                  }}
                />
                {errors.nickname && <span className={`text-xs ${styles.errorText}`}>{errors.nickname}</span>}
              </div>

              {/* 약관 동의 */}
              <div style={{ marginBottom: "24px" }}>
                <label className={`text-s ${styles.checkboxLabel}`}>
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={e => {
                      setAgree(e.target.checked);
                      if (errors.agree) setErrors({ ...errors, agree: "" });
                    }}
                    className={styles.checkbox}
                  />
                  <span>[필수] 이용약관 및 개인정보 처리방침 동의</span>
                </label>
                {errors.agree && (
                  <span className={`text-xs ${styles.errorText}`} style={{ display: "block", marginTop: "4px" }}>
                    {errors.agree}
                  </span>
                )}
              </div>

              {/* 하단 버튼 및 링크 */}
              <div className={styles.actionRow}>
                <div className={`text-s ${styles.loginLinkBox}`}>
                  이미 계정이 있으신가요?
                  <span onClick={onGoToLogin} className={styles.linkHighlight}>
                    로그인
                  </span>
                </div>
                <button type="submit" className={`text-button-m ${styles.btnPrimary}`}>
                  다음 (식단 정보 설정)
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
