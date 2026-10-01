import QRCodeImage from '../QRCodeImage'
import styles from './ClassQRModal.module.css'

export const SURVEY_URL = 'https://forms.gle/i49BrHNQ8UgDucKH8'

// 수업 참여 QR(ClassQRModal)과 같은 모양의 팝업으로 만족도 조사 링크 QR을 보여준다.
export default function SurveyQRModal({ onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="닫기">×</button>
        <h2>만족도 조사 QR 코드</h2>
        <div className={styles.divider} />
        <p className={styles.subtitle}>스캔하면 만족도 조사 페이지로 이동해요</p>
        <QRCodeImage url={SURVEY_URL} className={styles.qr} />
      </div>
    </div>
  )
}
