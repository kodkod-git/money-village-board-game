import styles from './AdminStatCards.module.css'

// cards: [{ label, value, tone, pending? }]. pending이면 아직 수집하지 않는 지표라 값 대신 "준비 중"을 단다.
export function StatCardRow({ cards }) {
  return (
    <div className={styles.row}>
      {cards.map(card => (
        <div key={card.label} className={styles.card}>
          <div className={`${styles.icon} ${styles[`tone-${card.tone}`]}`}>{card.value}</div>
          <span className={styles.label}>{card.label}</span>
          {card.pending && <span className={styles.pendingTag}>준비 중</span>}
        </div>
      ))}
    </div>
  )
}

export default function AdminStatCards({ rooms }) {
  const totalTeams = rooms.length
  const registered = rooms.filter(r => r.registered).length
  const unregistered = totalTeams - registered
  const totalMembers = rooms.reduce((sum, r) => sum + r.players.filter(Boolean).length, 0)

  return (
    <StatCardRow
      cards={[
        { label: '전체 팀', value: totalTeams, tone: 'neutral' },
        { label: '미등록', value: unregistered, tone: 'yellow' },
        { label: '등록 완료', value: registered, tone: 'blue' },
        { label: '전체 팀원', value: totalMembers, tone: 'purple' },
      ]}
    />
  )
}
