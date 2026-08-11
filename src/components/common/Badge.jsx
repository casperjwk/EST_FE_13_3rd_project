import styles from "./common.module.css";

const BADGE_TYPES = {
  safe: {
    icon: "check",
    label: "안전",
  },
  needReplacement: {
    icon: "refresh",
    label: "대체 필요",
  },
  danger: {
    icon: "warning_amber",
    label: "위험",
  },
  replacement: {
    icon: "refresh",
    label: "대체됨",
  },
};

function Badge({ type = "safe", className = "" }) {
  const badge = BADGE_TYPES[type];

  if (!badge) return null;

  return (
    <span
      className={`${styles["common-badge"]} ${styles[`common-badge--${type}`]} d-inline-flex align-items-center text-button-s ${className}`.trim()}
    >
      <span
        className={`material-symbols-outlined ${styles["common-badge__icon"]}`}
        aria-hidden="true"
      >
        {badge.icon}
      </span>
      {badge.label}
    </span>
  );
}

export default Badge;
