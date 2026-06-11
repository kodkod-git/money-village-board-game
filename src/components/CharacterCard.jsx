import styles from './CharacterCard.module.css'

export default function CharacterCard({ id, state, onSelect }) {
  return (
    <div
      className={`${styles.card} ${styles[state]}`}
      onClick={() => state !== 'locked' && onSelect(id)}
      role="button"
      aria-disabled={state === 'locked'}
    >
      {state === 'selected' && <span className={styles.badge}>✓</span>}
      {state === 'locked' && <span className={styles.badge}>🔒</span>}
      <img
        src={`/characters/${id}.png`}
        alt={id}
        className={styles.img}
      />
    </div>
  )
}
