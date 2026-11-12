import styles from './AlertModal.module.css'

// 확인 버튼 하나짜리 안내 모달. 사용자가 반드시 인지해야 하고 화면이
// 크게 바뀌는 상황(방 삭제, 강퇴 등)에 쓴다. 단순 정보는 toast()를 쓸 것.
// onCancel을 주면 취소 버튼이 함께 나와 예/아니요 확인에도 쓸 수 있다.
export default function AlertModal({ title, message, confirmLabel = '확인', onConfirm, cancelLabel = '취소', onCancel }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card} role="alertdialog" aria-modal="true">
        {title && <div className={styles.title}>{title}</div>}
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {onCancel && (
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button type="button" className={styles.confirmBtn} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
