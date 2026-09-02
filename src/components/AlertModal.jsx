import styles from './AlertModal.module.css'

// 확인 버튼 하나짜리 안내 모달. 사용자가 반드시 인지해야 하고 화면이
// 크게 바뀌는 상황(방 삭제, 강퇴 등)에 쓴다. 단순 정보는 toast()를 쓸 것.
export default function AlertModal({ title, message, confirmLabel = '확인', onConfirm }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card} role="alertdialog" aria-modal="true">
        {title && <div className={styles.title}>{title}</div>}
        <p className={styles.message}>{message}</p>
        <button type="button" className={styles.confirmBtn} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
