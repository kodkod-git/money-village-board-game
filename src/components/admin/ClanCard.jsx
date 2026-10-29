import { useState, useRef } from 'react'
import { CLAN_MEMBER_DRAG_TYPE } from '../../constants/clan'
import styles from './ClanCard.module.css'

const VISIBLE_SLOTS = 4
const MAX_NAME_LENGTH = 20

// 트로피 탭의 팀(클랜) 카드. 2×2 슬롯에 멤버를 보여주고, 5명 이상이면 "외 N명"으로 펼친다.
export default function ClanCard({ clan, onDropMember, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(clan.name)
  const [expanded, setExpanded] = useState(false)
  const [isOver, setIsOver] = useState(false)
  // Enter·Esc로 끝낸 뒤 입력창이 사라지며 blur가 한 번 더 와도 다시 저장하지 않게 막는다.
  const finishedRef = useRef(false)

  const { members } = clan
  const hiddenCount = Math.max(0, members.length - VISIBLE_SLOTS)
  const visible = expanded ? members : members.slice(0, VISIBLE_SLOTS)
  const emptySlots = Math.max(0, VISIBLE_SLOTS - members.length)

  function startEditing() {
    finishedRef.current = false
    setDraft(clan.name)
    setEditing(true)
  }

  function commit() {
    if (finishedRef.current) return
    finishedRef.current = true
    setEditing(false)
    const name = draft.trim()
    if (!name || name.length > MAX_NAME_LENGTH || name === clan.name) return
    onRename(clan.id, name)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      finishedRef.current = true
      setEditing(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsOver(false)
    const resultId = e.dataTransfer.getData(CLAN_MEMBER_DRAG_TYPE)
    if (!resultId || members.some(mb => mb.resultId === resultId)) return
    onDropMember(resultId, clan.id)
  }

  return (
    <section
      className={`${styles.card} ${isOver ? styles.over : ''}`}
      aria-label={clan.name}
      onDragOver={e => { e.preventDefault(); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
    >
      <div className={styles.header}>
        {editing ? (
          <input
            className={styles.nameInput}
            aria-label="팀 이름"
            value={draft}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
          />
        ) : (
          <button type="button" className={styles.name} aria-label={`${clan.name} 이름 바꾸기`} onClick={startEditing}>
            {clan.name}
          </button>
        )}
        <span className={styles.count}>{members.length}명</span>
        <button type="button" className={styles.deleteBtn} aria-label={`${clan.name} 삭제`} onClick={() => onDelete(clan)}>
          ×
        </button>
      </div>

      <ul className={styles.slots}>
        {visible.map(mb => (
          <li
            key={mb.resultId}
            className={styles.member}
            draggable
            onDragStart={e => e.dataTransfer.setData(CLAN_MEMBER_DRAG_TYPE, mb.resultId)}
          >
            <img src={`/characters/${mb.character}.png`} alt="" className={styles.avatar} />
            <span className={styles.memberName}>{mb.name}</span>
            <span className={styles.memberTeam}>{mb.teamName}</span>
          </li>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <li key={`empty-${i}`} className={styles.emptySlot} data-testid="empty-slot" />
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button type="button" className={styles.moreBtn} onClick={() => setExpanded(v => !v)}>
          {expanded ? '접기' : `외 ${hiddenCount}명`}
        </button>
      )}
    </section>
  )
}
