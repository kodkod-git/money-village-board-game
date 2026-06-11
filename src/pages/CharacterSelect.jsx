import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CharacterCard from '../components/CharacterCard'
import useSocket from '../hooks/useSocket'
import { CHARACTERS } from '../constants/characters'
import styles from './CharacterSelect.module.css'

export default function CharacterSelect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { socket } = useSocket()
  const [selected, setSelected] = useState(null)
  const [lockedByOthers, setLockedByOthers] = useState(new Set())

  const code = searchParams.get('code') ?? ''
  const name = searchParams.get('name') ?? ''
  const isHost = searchParams.get('host') === 'true'

  useEffect(() => {
    if (!socket) return
    const handler = ({ character }) =>
      setLockedByOthers(prev => new Set([...prev, character]))
    socket.on('character-locked', handler)
    return () => socket.off('character-locked', handler)
  }, [socket])

  function handleSelect(id) {
    setSelected(id)
    socket?.emit('character-preview', { code, character: id })
  }

  function handleSubmit() {
    if (!selected || !socket) return
    socket.emit('join-room', { code, name, character: selected, isHost }, ({ ok, error }) => {
      if (ok) navigate(`/lobby/${code}`)
      else alert(error)
    })
  }

  function getState(id) {
    if (id === selected) return 'selected'
    if (lockedByOthers.has(id)) return 'locked'
    return 'idle'
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.title}>캐릭터를 선택하세요</p>
        <p className={styles.subtitle}>{name} 님, 나를 대표할 캐릭터를 골라주세요</p>
      </div>
      <div className={styles.grid}>
        {CHARACTERS.map(id => (
          <CharacterCard key={id} id={id} state={getState(id)} onSelect={handleSelect} />
        ))}
      </div>
      <button className={styles.submitBtn} onClick={handleSubmit} disabled={!selected}>
        완료 → 로비 입장
      </button>
    </div>
  )
}
