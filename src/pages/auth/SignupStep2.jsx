import React, { useState } from "react";
import styles from "./SignupStep2.module.css";

const IconLightbulb = ({ size = 18, color = "var(--tag)" }) => (
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
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);

const IconAlert = ({ size = 18, color = "var(--tag)" }) => (
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
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

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
    <path d="M7 20h10" />
    <path d="M12 20v-8" />
    <path d="M12 12C12 7 7 4 2 6c0 5 4 8 10 6z" />
    <path d="M12 12c0-5 5-8 10-6 0 5-4 8-10 6z" />
  </svg>
);

const ALLERGIES = [
  "우유",
  "생선",
  "달걀",
  "복숭아",
  "밀",
  "토마토",
  "대두",
  "땅콩",
  "돼지고기",
  "견과류",
  "닭고기",
  "새우",
  "소고기",
  "게",
  "조개류",
];

const VEGAN_TYPES = [
  { id: "none", label: "일반", desc: "제한 없음" },
  { id: "flexitarian", label: "플렉시테리언", desc: "주로 채식, 가끔 육류 허용" },
  { id: "polo", label: "폴로", desc: "닭고기까지 허용" },
  { id: "pesco", label: "페스코", desc: "생선·해산물까지 허용" },
  { id: "lacto-ovo", label: "락토-오보", desc: "유제품·달걀 허용" },
  { id: "lacto", label: "락토", desc: "유제품만 허용" },
  { id: "ovo", label: "오보", desc: "달걀만 허용" },
  { id: "vegan", label: "비건", desc: "동물성 식품 완전 제외" },
];

export default function SignupStep2({ onPrev, onComplete, initialData = {} }) {
  const [selectedAllergies, setSelectedAllergies] = useState(initialData.allergies || []);
  const [selectedVegan, setSelectedVegan] = useState(initialData.veganType || "none");

  const toggleAllergy = item => {
    if (selectedAllergies.includes(item)) {
      setSelectedAllergies(selectedAllergies.filter(a => a !== item));
    } else {
      setSelectedAllergies([...selectedAllergies, item]);
    }
  };

  // 이전 단계로 갈 때 현재 선택한 식단/알레르기 값도 함께 전달
  const handlePrevClick = () => {
    if (onPrev) {
      onPrev({
        allergies: selectedAllergies,
        veganType: selectedVegan,
      });
    }
  };

  // 가입 완료 및 데이터 전달
  const handleCompleteClick = () => {
    if (onComplete) {
      onComplete({
        allergies: selectedAllergies,
        veganType: selectedVegan,
      });
    }
  };

  return (
    <div className={styles.outerWrapper} translate="no" lang="ko">
      <div className={styles.cardContainer}>
        {/* 상단 헤더 영역 */}
        <div className={styles.headerRow}>
          <div>
            <h2 className={`text-subtitle-l`} style={{ margin: "0 0 6px 0", color: "var(--black-1)" }}>
              맞춤 추천을 위한 식단 정보 선택
            </h2>
            <p className="text-s" style={{ color: "var(--gray-3)", margin: 0 }}>
              회원님의 알레르기 및 비건 식단 기준에 맞춰 AI가 레시피를 실시간 자동 조율해 드립니다.
            </p>
          </div>
          <button type="button" className={`text-button-s ${styles.btnSkip}`} onClick={handleCompleteClick}>
            다음에 설정하기(건너뛰기)
          </button>
        </div>

        {/* 안내 팁 박스 */}
        <div className={styles.tipBox}>
          <div className={styles.tipIconCircle}>
            <IconLightbulb size={18} color="var(--tag)" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="text-button-s" style={{ color: "var(--black-1)", marginBottom: "2px" }}>
              지금 안 골라도 괜찮아요!
            </div>
            <div className="text-s" style={{ color: "var(--gray-3)" }}>
              여기서 설정하지 않아도 가입 후{" "}
              <span style={{ color: "var(--primary)", fontWeight: "600" }}>[마이페이지 &gt; 설정]</span>에서 언제든 1초
              만에 수정하실 수 있어요!
            </div>
          </div>
        </div>

        {/* 1. 알레르기 정보 선택 */}
        <div className={styles.section}>
          <div className={styles.titleRow}>
            <IconAlert size={20} color="var(--tag)" />
            <h4 className={`text-subtitle-s ${styles.sectionTitle}`}>알레르기 정보</h4>
          </div>
          <p className={`text-xs ${styles.sectionSub}`}>
            해당하는 알레르기를 모두 선택해 주세요. 레시피 검색 시 자동으로 적용됩니다.
          </p>

          <div className={styles.chipGrid}>
            {ALLERGIES.map(item => {
              const isSelected = selectedAllergies.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  className={`text-s ${styles.chip} ${isSelected ? styles.chipSelected : styles.chipUnselected}`}
                  onClick={() => toggleAllergy(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 비건 유형 선택 */}
        <div className={styles.section}>
          <div className={styles.titleRow}>
            <IconSprout size={20} color="var(--primary)" />
            <h4 className={`text-subtitle-s ${styles.sectionTitle}`}>비건 유형</h4>
          </div>
          <p className={`text-xs ${styles.sectionSub}`}>
            비건 유형은 알레르기와 별개 기준입니다. 가장 가까운 식단 유형을 선택하세요.
          </p>

          <div className={styles.veganGrid}>
            {VEGAN_TYPES.map(type => {
              const isSelected = selectedVegan === type.id;
              return (
                <div
                  key={type.id}
                  onClick={() => setSelectedVegan(type.id)}
                  className={`${styles.veganCard} ${isSelected ? styles.veganCardSelected : styles.veganCardUnselected}`}
                >
                  <input
                    type="radio"
                    name="vegan"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                  <div>
                    <div className="text-button-s" style={{ color: "var(--black-1)" }}>
                      {type.label}
                    </div>
                    <div className="text-xs" style={{ color: "var(--gray-3)" }}>
                      {type.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 하단 버튼 그룹 */}
        <div className={styles.footerRow}>
          <button
            type="button"
            className={`text-button-s ${styles.btnSecondary} ${styles.btnPrevPc}`}
            onClick={handlePrevClick}
          >
            이전단계
          </button>
          <div className={styles.footerRightBtns}>
            <button type="button" className={`text-button-m ${styles.btnPrimary}`} onClick={handleCompleteClick}>
              가입 완료 및 메인 페이지 이동
            </button>
            <button type="button" className={`text-button-s ${styles.btnSecondary}`} onClick={handleCompleteClick}>
              나중에 설정하고 둘러보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
