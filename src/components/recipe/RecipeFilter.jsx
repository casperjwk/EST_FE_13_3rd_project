import { useEffect, useState } from "react";
import styles from "./recipeFilter.module.css";

const allergyItems = [
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

const veganItems = [
  "일반",
  "플렉시테리언",
  "폴로",
  "페스코",
  "락토-오보",
  "락토",
  "오보",
  "비건",
];

function FilterPanel({ allergyFilters, onAllergyChange, veganFilter, onVeganChange }){
  const [veganFilters, setVeganFilters] = useState(veganFilter ?? "일반");
  const [localAllergyFilters, setLocalAllergyFilters] = useState(allergyFilters ?? {});
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
  setVeganFilters(veganFilter ?? "일반");
}, [veganFilter]);

useEffect(() => {
  setLocalAllergyFilters(allergyFilters ?? {});
}, [allergyFilters]);

  
    const handleAllergyClick = item => {
    setLocalAllergyFilters(prev => {
      const current = prev[item] || "none";

      let next = "none";
      if (current === "none") next = "warning";
      else if (current === "warning") next = "exclude";

      const nextFilters = {
        ...prev,
        [item]: next,
      };

      onAllergyChange?.(nextFilters);
      return nextFilters;
    });
  };


  const handleVeganClick = (item) => {
    setVeganFilters(item);
    onVeganChange?.(item);
  }

const resetAllFilters = () => {
  setLocalAllergyFilters({});
  onAllergyChange?.({});

  setVeganFilters("일반");
  onVeganChange?.("일반");
};

const removeAllergyFilter = item => {
  setLocalAllergyFilters(prev => {
    const next = { ...prev };
    delete next[item];

    onAllergyChange?.(next);
    return next;
  });
};

  const selectedAllergies = Object.entries(localAllergyFilters).filter(
    ([,state]) => state !=="none"
  );

  return ( 
    <div className={styles.filterPanel}>
      <button 
      className={styles.sort}
      onClick={() => setIsFilterOpen(prev => !prev)}
      >
        <p>필터</p>
        <span
        className="material-icons">
          sort
          </span>
      </button>

    <div
      className={`${styles.filterContent} 
      ${isFilterOpen ? styles.open: styles.closed}`}
    >
      <div className={styles.filterBox}>
        <section className={styles.filterSection}>
          <div className={styles.sectionTitle}>
            <p className={`${styles.sectionTitleP} text-l`}>알레르기 분류</p>
            <span className={`${styles.sectionSpan} text-xs`}>빨강색은 분류에서 배제 주황색은 분류에서 포함입니다</span>
          </div>
          <div className={styles.chipList}>
            {allergyItems.map((item)=>{
              const state = localAllergyFilters[item] || "none";

              return (
                <button
                  key={item}
                  type="button"
                  className={`${styles.chip} ${styles.allergyChip} ${styles[state]} text-button-s`}
                  onClick={() => handleAllergyClick(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.filterSection}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionTitleP}>비건 분류</span>
          </div>

          <div className={styles.chipList}>
            {veganItems.map((item)=>{
              const selected = veganFilters === item;
              return(
                <button
                  key={item}
                  type="button"
                  className={`${styles.chip} ${styles.veganChip} ${
                    selected ? styles.selected : ""
                  } text-button-s`}
                  onClick={()=> handleVeganClick(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>

      <div className={styles.selectedFilterList}>
        {selectedAllergies.length > 0 && (
          <button
            type="button"
            className={`${styles.resetChip} text-button-s`}
            onClick={resetAllFilters}
          >
            x 전체삭제
          </button>
        )}

        {selectedAllergies.map(([item, state]) => (
        <button
          key={item}
          type="button"
          className={`${styles.chip} ${styles.allergyChip} ${styles[state]} text-button-s`}
          onClick={() => removeAllergyFilter(item)}
        >
          {item}
        </button>
        ))}
      </div>
    </div>
  )
}

export default FilterPanel;