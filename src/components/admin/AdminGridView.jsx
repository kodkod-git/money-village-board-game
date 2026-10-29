import AdminGridCard from './AdminGridCard'
import styles from './AdminGridView.module.css'

// allRooms: 검색 전 전체 목록. 카드의 "팀 N" 번호를 관전 팝업과 같게 전체 목록 순서로 매긴다.
export default function AdminGridView({ rooms, allRooms = rooms, onSpectate, onCreate, onRoomChanged }) {
  return (
    <div className={styles.grid}>
      {rooms.map(room => (
        <AdminGridCard
          key={room.code}
          room={room}
          index={allRooms.findIndex(r => r.code === room.code)}
          onSpectate={onSpectate}
          onRoomChanged={onRoomChanged}
        />
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
