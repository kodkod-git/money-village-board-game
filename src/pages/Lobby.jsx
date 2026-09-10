import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import CodeModal from '../components/CodeModal'
import RoomCard from '../components/RoomCard'
import { useSocketContext } from '../contexts/SocketContext'
import useBodyClass from '../hooks/useBodyClass'
import { toast } from '../utils/toast'
import { resetPlayerUuid } from '../utils/playerUuid'
import styles from './Lobby.module.css'
import joinStyles from './NameInput.module.css'

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

  // 코드로만 참여하는 "팀 참여" 화면은 다른 온보딩 화면(홈·이름 입력·캐릭터
  // 선택·팀 화면)과 같은 #root 프레임(container-type: size)을 써야 NameInput
  // 스타일의 cqw/cqh 스케일(--sx/--sy)이 정상 계산된다. classId 그리드(로비)
  // 뷰는 기존 레이아웃을 그대로 둔다.
  useBodyClass(classId ? null : 'onboarding-mode')

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
        // 로비는 참여 과정의 임시 단계다 — 히스토리에 남겨두면 팀 화면에서
        // 뒤로가기 시 로비로 돌아와 자동 재참여되며 루프가 생긴다. replace로
        // 치워서 뒤로가기가 캐릭터 선택 → 이름 입력 → 팀 코드 입력 → 홈으로
        // 곧장 이어지게 한다.
        navigate(`/team/${code}`, { replace: true })
      } else {
        setIsJoining(false)
        toast(error || '팀에 참여하지 못했어요')
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

  if (!classId) {
    return (
      <div className={joinStyles.page}>
        <BackButton />
        <div className={joinStyles.header}>
          <h1 className={joinStyles.title}>팀 참여</h1>
          <p className={joinStyles.subtitle}>팀장에게 받은 코드를 입력해주세요</p>
        </div>
        <div className={joinStyles.card}>
          <div className={joinStyles.inputGroup}>
            <label className={joinStyles.label}>초대 코드</label>
            <input
              className={joinStyles.input}
              placeholder="예: A3B2C1"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoinByCode(codeInput)}
              maxLength={6}
            />
          </div>
          <button
            className={joinStyles.gradBtn}
            onClick={() => handleJoinByCode(codeInput)}
            disabled={isJoining || !codeInput}
            type="button"
          >
            팀 참여하기
          </button>
        </div>
      </div>
    )
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
            title={room.title}
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
