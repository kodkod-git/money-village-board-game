import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import CodeModal from '../components/CodeModal'
import useSocket from '../hooks/useSocket'
import { getPlayerUuid } from '../utils/playerUuid'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { socket } = useSocket()
  const [showCodeModal, setShowCodeModal] = useState(false)

  const name = searchParams.get('name') ?? ''
  const affiliation = searchParams.get('affiliation') ?? ''
  const character = searchParams.get('character') ?? ''
  const initialCode = searchParams.get('code') ?? ''

  useEffect(() => {
    if (initialCode) setShowCodeModal(true)
  }, [initialCode])

  function joinRoom(code, isHost) {
    const playerUuid = getPlayerUuid()
    socket.emit('join-room', { code, name, affiliation, character, isHost, playerUuid }, ({ ok, error }) => {
      if (ok) {
        sessionStorage.setItem('player_profile', JSON.stringify({ name, affiliation, character, code, isHost }))
        navigate(`/lobby/${code}`)
      } else alert(error)
    })
  }

  async function handleCreate() {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affiliation }),
    })
    const { code } = await res.json()
    joinRoom(code, true)
  }

  function handleJoinByCode(code) {
    setShowCodeModal(false)
    joinRoom(code, false)
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.center}>
        <h1 className={styles.title}>팀 구성</h1>
        <p className={styles.subtitle}>팀을 만들거나 참여하세요</p>
      </div>
      <hr className={styles.divider} />
      {(character || name) && (
        <div className={styles.preview}>
          {character && (
            <img src={`/characters/${character}.png`} alt="" className={styles.previewImg} />
          )}
          {name && <span className={styles.previewName}>{name}</span>}
        </div>
      )}
      <div className={styles.cards}>
        <button className={styles.card} onClick={handleCreate}>
          <span className={styles.icon}>⊞</span>
          <span className={styles.cardTitle}>팀 만들기</span>
          <span className={styles.cardDesc}>새 팀 생성 후 코드 공유</span>
          <span className={styles.chevron}>›</span>
        </button>
        <button className={styles.card} onClick={() => setShowCodeModal(true)}>
          <span className={styles.icon}>🔑</span>
          <span className={styles.cardTitle}>팀 참여</span>
          <span className={styles.cardDesc}>초대 코드로 팀 입장</span>
          <span className={styles.chevron}>›</span>
        </button>
      </div>
      {showCodeModal && (
        <CodeModal
          initialCode={initialCode}
          onSubmit={handleJoinByCode}
          onClose={() => setShowCodeModal(false)}
        />
      )}
    </div>
  )
}
