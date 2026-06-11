import styles from './QRModal.module.css'

export default function QRModal({ code, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="닫기">✕</button>
        <h2>내 팀의 QR 코드</h2>
        <div className={styles.divider} />
        <p className={styles.subtitle}>스캔해서 제 팀에 참가하세요!</p>
        <img src={`/api/rooms/${code}/qr`} alt="QR 코드" className={styles.qr} />
      </div>
    </div>
  )
}
