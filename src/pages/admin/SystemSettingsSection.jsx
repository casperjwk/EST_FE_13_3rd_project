import React, { useState, useEffect } from "react";
import styles from "./SystemSettingsSection.module.css";
import { supabase } from "../../lib/supabase";

const ChevronDownIcon = ({ isOpen }) => (
  <svg
    className={`${styles.chevronIcon} ${isOpen ? styles.chevronOpen : ""}`}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const SystemSettingsSection = () => {
  const [allowOnDemand, setAllowOnDemand] = useState(true);
  const [showCrossContamModal, setShowCrossContamModal] = useState(false);
  const [cardCount, setCardCount] = useState("5개 노출(권장)");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const options = ["3개 노출(기본)", "5개 노출(권장)", "10개 노출"];

  // 컴포넌트 마운트 시 Supabase에서 설정값 불러오기
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle();

        if (error) {
          console.error("시스템 설정 조회 오류:", error.message);
        } else if (data) {
          setAllowOnDemand(data.allow_on_demand);
          setShowCrossContamModal(data.show_cross_contam_modal);
          setCardCount(data.card_count);
        }
      } catch (err) {
        console.error("시스템 설정 로드 예외:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // 설정 저장 클릭 시 Supabase DB에 업데이트
  const handleSave = async () => {
    const isConfirmed = window.confirm(
      "[주의] 시스템 설정을 변경하면 서비스 전체 기능 및 회원 화면에 즉시 영향을 미칩니다.\n\n정말로 이대로 변경 사항을 저장하시겠습니까?",
    );

    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from("admin_settings")
        .update({
          allow_on_demand: allowOnDemand,
          show_cross_contam_modal: showCrossContamModal,
          card_count: cardCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) {
        console.error("시스템 설정 저장 오류:", error.message);
        alert(`설정 저장 실패: ${error.message}`);
        return;
      }

      alert("시스템 설정이 Supabase DB에 성공적으로 저장되었습니다.");
    } catch (err) {
      console.error("시스템 설정 저장 예외:", err);
      alert("설정 저장 중 오류가 발생했습니다.");
    }
  };

  if (isLoading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>시스템 설정을 불러오는 중...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>시스템 설정</h1>
        <p className={styles.subtitle}>한끼랩 관리자 권한 및 AI 임계값 세팅을 관리합니다.</p>
      </div>

      <div className={styles.card}>
        <div className={styles.settingItem}>
          <div className={styles.settingText}>
            <h3 className={styles.itemTitle}>버튼 클릭 시 실시간(On-Demand) AI 레시피 변환 허용</h3>
            <p className={styles.itemDesc}>
              회원이 레시피 상세 페이지에서 'AI 대체 레시피 생성' 버튼을 누를 때마다 실시간으로 변환을 수행합니다.
            </p>
          </div>
          <label className={styles.toggleSwitch}>
            <input type="checkbox" checked={allowOnDemand} onChange={e => setAllowOnDemand(e.target.checked)} />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.settingItem}>
          <div className={styles.settingText}>
            <h3 className={styles.itemTitle}>교차오염 위험 팝업 강제 노출</h3>
            <p className={styles.itemDesc}>
              '교차오염 주의' 레시피 조회 시 회원의 알레르기 안전을 위해 팝업을 표시합니다.
            </p>
          </div>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={showCrossContamModal}
              onChange={e => setShowCrossContamModal(e.target.checked)}
            />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.selectGroup}>
          <div className={styles.settingText}>
            <h3 className={styles.itemTitle}>검색 결과 AI 실시간 대체 카드 기본 추천 개수</h3>
            <p className={styles.itemDesc}>회원이 식단을 검색했을 때 기본으로 추천되는 대체 레시피 카드의 수입니다.</p>
          </div>

          <div className={styles.selectWrapper}>
            <div className={styles.selectInput} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <span>{cardCount}</span>
              <ChevronDownIcon isOpen={isDropdownOpen} />
            </div>

            {isDropdownOpen && (
              <div className={styles.dropdownList}>
                {options.map(opt => (
                  <button
                    key={opt}
                    className={`${styles.dropdownOption} ${cardCount === opt ? styles.selected : ""}`}
                    onClick={() => {
                      setCardCount(opt);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.saveBtnArea}>
          <button className={styles.saveBtn} onClick={handleSave}>
            설정 저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsSection;
