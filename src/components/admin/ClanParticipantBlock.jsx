import { useState } from 'react'
import { CLAN_MEMBER_DRAG_TYPE } from '../../constants/clan'
import styles from './ClanParticipantBlock.module.css'

// 트로피 탭: 결과 등록을 마쳤지만 아직 팀(클랜)에 배정되지 않은 참여자.
// 카드를 팀 카드로 끌어 배정하고, 팀 카드의 멤버를 여기로 끌어오면 배정을 해제한다.
export default function ClanParticipantBlock({ participants, onDropMember }) {
  const [isOver, setIsOver] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setIsOver(false)
    const resultId = e.dataTransfer.getData(CLAN_MEMBER_DRAG_TYPE)
    if (!resultId || participants.some(p => p.resultId === resultId)) return
    onDropMember(resultId)
  }

  return (
    <section
      className={`${styles.block} ${isOver ? styles.over : ''}`}
      aria-label="참여자"
      onDragOver={e => { e.preventDefault(); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>참여자</h2>
        <span className={styles.count}>{participants.length}명</span>
        <span className={styles.hint}>팀 카드로 끌어다 놓아 배정하세요</span>
      </div>
      {participants.length === 0 ? (
        <p className={styles.empty}>결과 등록을 마친 참여자가 여기에 표시돼요</p>
      ) : (
        <ul className={styles.list}>
          {participants.map(p => (
            <li
              key={p.resultId}
              className={styles.item}
              draggable
              onDragStart={e => e.dataTransfer.setData(CLAN_MEMBER_DRAG_TYPE, p.resultId)}
            >
              <img src={`/characters/${p.character}.png`} alt="" className={styles.avatar} />
              <span className={styles.name}>{p.name}</span>
              <span className={styles.team}>{p.teamName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
