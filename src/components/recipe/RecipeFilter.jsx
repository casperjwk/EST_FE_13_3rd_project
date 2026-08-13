import { useState } from "react";
import styles from "./recipeFilter.module.css";

const ALLERGY_DISPLAY_ORDER = [
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
  "버섯",
];

const VEGAN_DISPLAY_ORDER = [
  "일반",
  "플렉시테리언",
  "폴로",
  "페스코",
  "락토-오보",
  "락토",
  "오보",
  "비건",
];

function sortByDisplayOrder(options, displayOrder) {
  return [...options].sort((a, b) => {
    const aIndex = displayOrder.indexOf(a.name);
    const bIndex = displayOrder.indexOf(b.name);

    if (aIndex === -1 && bIndex === -1) {
      return a.name.localeCompare(b.name, "ko");
    }
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;

    return aIndex - bIndex;
  });
}

function sortVeganOptions(veganOptions) {
  return sortByDisplayOrder(veganOptions, VEGAN_DISPLAY_ORDER);
}

function FilterPanel({
  allergyFilters,
  onAllergyChange,
  allergyOptions = [],
  veganFilter,
  onVeganChange,
  veganOptions = [],
}) {
  const defaultVeganType = veganOptions.find(option => option.name === "일반");
  const defaultVeganTypeId = defaultVeganType?.id ?? null;
  const currentVeganFilter = veganFilter ?? defaultVeganTypeId ?? "";
  const currentAllergyFilters = allergyFilters ?? {};
  const sortedAllergyOptions = sortByDisplayOrder(allergyOptions, ALLERGY_DISPLAY_ORDER);
  const sortedVeganOptions = sortVeganOptions(veganOptions);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleAllergyClick = allergenId => {
    const filterKey = String(allergenId);
    const current = currentAllergyFilters[filterKey] || "none";

    let next = "none";
    if (current === "none") next = "warning";
    else if (current === "warning") next = "exclude";

    onAllergyChange?.({
      ...currentAllergyFilters,
      [filterKey]: next,
    });
  };

  const handleVeganClick = veganTypeId => {
    onVeganChange?.(veganTypeId);
  };

  const resetAllFilters = () => {
    onAllergyChange?.({});
    onVeganChange?.(defaultVeganTypeId);
  };

  const removeAllergyFilter = allergenId => {
    const next = { ...currentAllergyFilters };
    delete next[String(allergenId)];

    onAllergyChange?.(next);
  };

  const selectedAllergies = Object.entries(currentAllergyFilters).filter(
    ([, state]) => state !== "none",
  );

  return (
    <div className={styles.filterPanel}>
      <button className={styles.sort} onClick={() => setIsFilterOpen((prev) => !prev)}>
        <p>필터</p>
        <span className="material-icons">sort</span>
      </button>

      <div
        className={`${styles.filterContent} 
      ${isFilterOpen ? styles.open : styles.closed}`}
      >
        <div className={styles.filterBox}>
          <section className={styles.filterSection}>
            <div className={styles.sectionTitle}>
              <p className={`${styles.sectionTitleP} text-l`}>알레르기 분류</p>
              <span className={`${styles.sectionSpan} text-xs`}>
                빨강색은 분류에서 배제 주황색은 분류에서 포함입니다
              </span>
            </div>
            <div className={styles.chipList}>
              {sortedAllergyOptions.map(allergy => {
                const filterKey = String(allergy.id);
                const state = currentAllergyFilters[filterKey] || "none";

                return (
                  <button
                    key={allergy.id}
                    type="button"
                    className={`${styles.chip} ${styles.allergyChip} ${styles[state]} text-button-s`}
                    onClick={() => handleAllergyClick(allergy.id)}
                  >
                    {allergy.name}
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
              {sortedVeganOptions.map(veganType => {
                const selected = String(currentVeganFilter) === String(veganType.id);
                return (
                  <button
                    key={veganType.id}
                    type="button"
                    className={`${styles.chip} ${styles.veganChip} ${
                      selected ? styles.selected : ""
                    } text-button-s`}
                    onClick={() => handleVeganClick(veganType.id)}
                  >
                    {veganType.name}
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

        {selectedAllergies.map(([allergenId, state]) => {
          const allergy = allergyOptions.find(option => String(option.id) === String(allergenId));

          return (
            <button
              key={allergenId}
              type="button"
              className={`${styles.chip} ${styles.allergyChip} ${styles[state]} text-button-s`}
              onClick={() => removeAllergyFilter(allergenId)}
            >
              {allergy?.name ?? allergenId}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FilterPanel;
