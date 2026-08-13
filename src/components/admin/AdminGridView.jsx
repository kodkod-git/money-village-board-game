import AdminGridCard from './AdminGridCard'
import styles from './AdminGridView.module.css'

export default function AdminGridView({ rooms, onSpectate, onCreate, onRoomChanged }) {
  return (
    <div className={styles.grid}>
      {rooms.map(room => (
        <AdminGridCard key={room.code} room={room} onSpectate={onSpectate} onRoomChanged={onRoomChanged} />
      ))}
      {onCreate && (
        <button className={styles.createCard} onClick={onCreate} type="button">
          <span className={styles.createIcon} aria-hidden="true">+</span>
          <span className={styles.createLabel}>방 만들기</span>
        </button>
      )}
    </div>
  )
}
