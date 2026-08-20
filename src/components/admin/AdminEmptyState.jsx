import styles from './AdminEmptyState.module.css'

const DEFAULT_ICON = (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
  </svg>
)

export default function AdminEmptyState({
  title, subtitle, actionLabel, onAction,
  icon = DEFAULT_ICON, tone = 'gray', actionVariant = 'filled',
}) {
  return (
    <div className={styles.wrap}>
      <div className={`${styles.icon} ${tone === 'blue' ? styles.iconBlue : ''}`} aria-hidden="true">
        {icon}
      </div>
      <p className={styles.title}>{title}</p>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {actionLabel && (
        <button
          type="button"
          className={`${styles.actionBtn} ${actionVariant === 'outline' ? styles.actionBtnOutline : ''}`}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
