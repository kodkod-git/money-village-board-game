import styles from './RecapIntroSlide.module.css'

export default function RecapIntroSlide({ className, teamCount, memberCount }) {
  return (
    <div className={styles.slide}>
      <span className={styles.trophy} aria-hidden="true">🏆</span>
      <h2 className={styles.title}>{className} 팀 대결 결과</h2>
      <p className={styles.summary}>{teamCount}개 팀 · {memberCount}명이 겨뤘어요</p>
      <p className={styles.hint}>오른쪽으로 넘겨 결과를 확인하세요 ›</p>
    </div>
  )
}
