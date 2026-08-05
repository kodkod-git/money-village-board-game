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
  const [isJoining, setIsJoining] = useState(false)

  const name = searchParams.get('name') ?? ''
  const affiliation = searchParams.get('affiliation') ?? ''
  const classId = searchParams.get('classId') ?? ''
  const character = searchParams.get('character') ?? ''
  const initialCode = searchParams.get('code') ?? ''
  const [codeInput, setCodeInput] = useState(initialCode.toUpperCase())

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
    if (initialCode && classId) setShowCodeModal(true)
  }, [initialCode, classId])

  // classId 없이 코드만 들고 들어온 경우(랜딩페이지의 "게임 참여"나 팀 초대
  // QR을 통한 진입) 이미 참여할 팀이 정해져 있으므로, 입력창을 다시 누르게
  // 하지 않고 화면 진입과 동시에 바로 참가를 시도한다.
  useEffect(() => {
    if (!socket || classId || !initialCode) return
    handleJoinByCode(initialCode.toUpperCase())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, classId, initialCode])

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
    // 이미 이 방에 참여한 적이 있다면(같은 code) 기존 playerUuid를 재사용해
    // 재접속으로 처리되게 한다 — 매번 새 uuid를 발급하면 같은 사람이 같은
    // 방에 중복으로 들어가는 것처럼 보이는 문제가 생긴다.
    const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
    const existingUuid = sessionStorage.getItem('player_uuid')
    const playerUuid = (stored?.code === code && existingUuid) ? existingUuid : resetPlayerUuid()

    socket.emit('join-room', { code, name, affiliation, character, isHost, playerUuid }, ({ ok, error }) => {
      if (ok) {
        sessionStorage.setItem('player_profile', JSON.stringify({ name, affiliation, character, code, isHost, classId }))
        navigate(`/team/${code}`)
      } else {
        setIsJoining(false)
        alert(error)
      }
    })
  }

  async function handleCreate() {
    if (isJoining) return
    setIsJoining(true)
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: classId || null }),
    })
    const { code } = await res.json()
    joinRoom(code, true)
  }

  function handleJoinRoomCard(code) {
    if (isJoining) return
    setIsJoining(true)
    joinRoom(code, false)
  }

  function handleJoinByCode(code) {
    if (isJoining) return
    setIsJoining(true)
    setShowCodeModal(false)
    joinRoom(code, false)
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>{classId ? '로비' : '팀 참여'}</h1>
        <p className={styles.subtitle}>
          {classId ? '참여할 팀을 선택하거나 새 팀을 만드세요' : '팀 코드를 입력해 참여하세요'}
        </p>
      </div>
      <hr className={styles.divider} />

      {classId ? (
        <div className={styles.grid}>
          {rooms.map(room => (
            <RoomCard
              key={room.code}
              hostName={room.hostName}
              status={room.status}
              characters={room.characters}
              onClick={() => handleJoinRoomCard(room.code)}
            />
          ))}
          <button className={styles.createCard} onClick={handleCreate} disabled={isJoining} type="button">
            <span className={styles.createIcon} aria-hidden="true">+</span>
            <span className={styles.createLabel}>방 만들기</span>
          </button>
        </div>
      ) : (
        <div className={styles.codeEntry}>
          <input
            className={styles.codeInput}
            placeholder="팀 코드를 입력하세요"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button
            className={styles.codeSubmitBtn}
            onClick={() => handleJoinByCode(codeInput)}
            disabled={isJoining || !codeInput}
            type="button"
          >
            참가
          </button>
        </div>
      )}

      {classId && showCodeModal && (
        <CodeModal
          initialCode={initialCode}
          onSubmit={handleJoinByCode}
          onClose={() => setShowCodeModal(false)}
        />
      )}
    </div>
  )
}
