import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import CodeModal from '../components/CodeModal'
import RoomCard from '../components/RoomCard'
import { useSocketContext } from '../contexts/SocketContext'
import { resetPlayerUuid } from '../utils/playerUuid'
import styles from './Lobby.module.css'

export default function Lobby() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { socket } = useSocketContext()
  const [rooms, setRooms] = useState([])
  const [showCodeModal, setShowCodeModal] = useState(false)

  const name = searchParams.get('name') ?? ''
  const affiliation = searchParams.get('affiliation') ?? ''
  const classId = searchParams.get('classId') ?? ''
  const character = searchParams.get('character') ?? ''
  const initialCode = searchParams.get('code') ?? ''

  const loadRooms = useCallback(() => {
    if (!classId) return
    fetch(`/api/rooms?classId=${encodeURIComponent(classId)}`)
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
  }, [classId])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  useEffect(() => {
    if (initialCode) setShowCodeModal(true)
  }, [initialCode])

  useEffect(() => {
    if (!socket || !classId) return
    socket.emit('watch-class-rooms', { classId })
    socket.on('class-rooms-updated', loadRooms)
    return () => {
      socket.emit('unwatch-class-rooms', { classId })
      socket.off('class-rooms-updated', loadRooms)
    }
  }, [socket, classId, loadRooms])

  function joinRoom(code, isHost) {
    const playerUuid = resetPlayerUuid()
    socket.emit('join-room', { code, name, affiliation, character, isHost, playerUuid }, ({ ok, error }) => {
      if (ok) {
        sessionStorage.setItem('player_profile', JSON.stringify({ name, affiliation, character, code, isHost, classId }))
        navigate(`/team/${code}`)
      } else alert(error)
    })
  }

  async function handleCreate() {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: classId || null }),
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
      <div className={styles.header}>
        <h1 className={styles.title}>로비</h1>
        <p className={styles.subtitle}>참여할 팀을 선택하거나 새 팀을 만드세요</p>
      </div>
      <hr className={styles.divider} />

      <div className={styles.grid}>
        {rooms.map(room => (
          <RoomCard
            key={room.code}
            hostName={room.hostName}
            status={room.status}
            characters={room.characters}
            onClick={() => joinRoom(room.code, false)}
          />
        ))}
        <button className={styles.createCard} onClick={handleCreate} type="button">
          <span className={styles.createIcon} aria-hidden="true">+</span>
          <span className={styles.createLabel}>방 만들기</span>
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
