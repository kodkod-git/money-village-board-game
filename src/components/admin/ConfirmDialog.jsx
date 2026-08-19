import styles from './ConfirmDialog.module.css'

const ICONS = {
  danger: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  ),
  primary: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
}

export default function ConfirmDialog({
  tone = 'danger',
  title,
  description,
  cancelLabel = '아니요',
  confirmLabel = '예',
  onCancel,
  onConfirm,
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={`${styles.iconBadge} ${tone === 'danger' ? styles.iconBadgeDanger : styles.iconBadgePrimary}`}>
          {ICONS[tone]}
        </div>
        <div className={styles.textGroup}>
          <span className={styles.title}>{title}</span>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={`${styles.confirmBtn} ${tone === 'danger' ? styles.confirmBtnDanger : styles.confirmBtnPrimary}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
