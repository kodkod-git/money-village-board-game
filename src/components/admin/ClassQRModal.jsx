import QRCodeImage from '../QRCodeImage'
import styles from './ClassQRModal.module.css'

function buildClassJoinUrl(classId) {
  const origin = window.location?.origin ?? ''
  return `${origin}/join?classId=${encodeURIComponent(classId)}`
}

export default function ClassQRModal({ classId, name, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="닫기">×</button>
        <h2>{name} 수업 QR 코드</h2>
        <div className={styles.divider} />
        <p className={styles.subtitle}>스캔하면 이름만 입력하고 바로 참가할 수 있어요</p>
        <QRCodeImage url={buildClassJoinUrl(classId)} className={styles.qr} />
      </div>
    </div>
  )
}
