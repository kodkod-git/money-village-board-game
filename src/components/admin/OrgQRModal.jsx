import QRCodeImage from '../QRCodeImage'
import styles from './OrgQRModal.module.css'

function buildOrgJoinUrl(orgName) {
  const origin = window.location?.origin ?? ''
  return `${origin}/join?affiliation=${encodeURIComponent(orgName)}`
}

export default function OrgQRModal({ orgName, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="닫기">×</button>
        <h2>{orgName} 소속 QR 코드</h2>
        <div className={styles.divider} />
        <p className={styles.subtitle}>스캔하면 소속 입력 없이 바로 참가할 수 있어요</p>
        <QRCodeImage url={buildOrgJoinUrl(orgName)} className={styles.qr} />
      </div>
    </div>
  )
}
