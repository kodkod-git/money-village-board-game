import styles from './RecapCelebration.module.css'

const COLORS = ['#e23d4f', '#2a78d6', '#1baf7a', '#8a4fe0', '#ff8a1f', '#ffffff']
const PIECE_COUNT = 48

// 렌더링마다 흩어지는 모양이 바뀌지 않도록 난수 대신 번호로 위치를 정한다.
const PIECES = Array.from({ length: PIECE_COUNT }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  background: COLORS[i % COLORS.length],
  '--fall-delay': `${1200 + ((i * 113) % 1500)}ms`,
  '--fall-ms': `${2200 + ((i * 71) % 1400)}ms`,
  '--drift': `${((i * 29) % 80) - 40}px`,
}))

// 커튼이 양옆으로 걷히고, 빵빠레와 색종이가 터진다. 움직임 줄이기 설정이면 CSS에서 모두 감춘다.
export default function RecapCelebration() {
  return (
    <div className={styles.layer} aria-hidden="true" data-testid="recap-celebration">
      {PIECES.map((style, i) => <span key={i} className={styles.piece} style={style} />)}
      <span className={`${styles.popper} ${styles.popperLeft}`}>🎉</span>
      <span className={`${styles.popper} ${styles.popperRight}`}>🎉</span>
      <div className={`${styles.curtain} ${styles.curtainLeft}`} />
      <div className={`${styles.curtain} ${styles.curtainRight}`} />
    </div>
  )
}
