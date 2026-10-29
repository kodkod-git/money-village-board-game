import styles from './ClanRecapPage.module.css'

// 팀(클랜) 통계 화면. 내용은 다음 작업에서 만든다.
export default function ClanRecapPage({ className, onBack }) {
  return (
    <div className={styles.page}>
      <button type="button" className={styles.backBtn} aria-label="팀 현황으로 돌아가기" onClick={onBack}>
        ← 팀 현황
      </button>
      <h1 className={styles.title}>팀 대결 결과</h1>
      <p className={styles.className}>{className}</p>
      <div className={styles.placeholder}>
        <span className={styles.icon} aria-hidden="true" />
        <p>준비 중이에요</p>
      </div>
    </div>
  )
}
