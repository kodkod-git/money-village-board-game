import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CodeModal from '../components/CodeModal'
import useSocket from '../hooks/useSocket'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { socket } = useSocket()
  const [showCodeModal, setShowCodeModal] = useState(false)

  const name = searchParams.get('name') ?? ''
  const character = searchParams.get('character') ?? ''
  const initialCode = searchParams.get('code') ?? ''

  useEffect(() => {
    if (initialCode) setShowCodeModal(true)
  }, [initialCode])

  function joinRoom(code, isHost) {
    socket.emit('join-room', { code, name, character, isHost }, ({ ok, error }) => {
      if (ok) navigate(`/lobby/${code}`)
      else alert(error)
    })
  }

  async function handleCreate() {
    const res = await fetch('/api/rooms', { method: 'POST' })
    const { code } = await res.json()
    joinRoom(code, true)
  }

  function handleJoinByCode(code) {
    setShowCodeModal(false)
    joinRoom(code, false)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>💰 Money Village</h1>
      <p className={styles.subtitle}>보드게임 팀 구성 시스템</p>
      <div className={styles.buttons}>
        <button className={styles.createBtn} onClick={handleCreate}>팀 만들기</button>
        <button className={styles.joinBtn} onClick={() => setShowCodeModal(true)}>팀 참가</button>
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
