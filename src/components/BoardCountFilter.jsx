import { BOARD_COUNTS } from '../constants/gameData'
import styles from './BoardCountFilter.module.css'

// 랭킹을 게임 진행 방식(6판/5판)별로 나눠 볼 때 쓰는 작은 체크박스 묶음.
// 둘 중 하나만 고를 수 있다(이미 고른 쪽을 다시 눌러도 해제되지 않는다).
export default function BoardCountFilter({ value, onChange }) {
  return (
    <div className={styles.row} role="group" aria-label="게임 진행 방식">
      {BOARD_COUNTS.map(count => {
        const checked = value === count
        return (
          <label key={count} className={`${styles.option} ${checked ? styles.optionChecked : ''}`}>
            <input
              type="checkbox"
              className={styles.input}
              checked={checked}
              onChange={() => { if (!checked) onChange(count) }}
            />
            <span className={styles.box} aria-hidden="true" />
            {count}판
          </label>
        )
      })}
    </div>
  )
}
