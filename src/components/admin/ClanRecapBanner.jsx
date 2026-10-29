import styles from './ClanRecapBanner.module.css'

// 트로피 탭 맨 위의 클랜 통계 배너(Discord Checkpoint 배너 참고). 띠 전체가 버튼이다.
export default function ClanRecapBanner({ onOpen }) {
  return (
    <button type="button" className={styles.banner} onClick={onOpen}>
      <span className={styles.icon} aria-hidden="true" />
      <span className={styles.text}>
        <span className={styles.title}>팀 대결 결과</span>
        <span className={styles.subtitle}>팀별 자산을 한눈에 비교해 보세요</span>
      </span>
      <span className={styles.arrow} aria-hidden="true">→</span>
    </button>
  )
}
