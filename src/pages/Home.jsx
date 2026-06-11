import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CodeModal from '../components/CodeModal'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showCodeModal, setShowCodeModal] = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) navigate(`/name?code=${code}`)
  }, [searchParams, navigate])

  async function handleCreate() {
    const res = await fetch('/api/rooms', { method: 'POST' })
    const { code } = await res.json()
    navigate(`/name?code=${code}&host=true`)
  }

  function handleJoinByCode(code) {
    setShowCodeModal(false)
    navigate(`/name?code=${code}`)
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
        <CodeModal onSubmit={handleJoinByCode} onClose={() => setShowCodeModal(false)} />
      )}
    </div>
  )
}
