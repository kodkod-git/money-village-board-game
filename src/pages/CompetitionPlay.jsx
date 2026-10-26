import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import AssetInputSteps from '../components/AssetInputSteps'
import AlertModal from '../components/AlertModal'
import { DEFAULT_PRICES } from '../components/PriceSettingModal'
import { useSocketContext } from '../contexts/SocketContext'
import useBodyClass from '../hooks/useBodyClass'
import { getPlayerUuid } from '../utils/playerUuid'
import inputStyles from './IndividualPage.module.css'
import styles from './CompetitionPlay.module.css'

// 경쟁 모드: 팀 없이 자산을 입력하고, 입력을 마치면 관리자가 결과를 등록할 때까지 기다린다.
// 가격 단계가 생기기 전에 들어온 참여자처럼 가격이 없으면 기본 가격으로 시작한다.
function withPrices(gameState) {
  return gameState?.prices ? gameState : { ...gameState, prices: DEFAULT_PRICES }
}

export default function CompetitionPlay() {
  useBodyClass('onboarding-mode')
  const { classId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { socket } = useSocketContext()

  const name = searchParams.get('name') ?? ''
  const affiliation = searchParams.get('affiliation') ?? ''
  const character = searchParams.get('character') ?? ''
  const hasProfile = Boolean(name && character)
  const joinPath = `/join?classId=${encodeURIComponent(classId)}`

  const [gameState, setGameState] = useState(null)
  const [syncToken, setSyncToken] = useState(0)
  const [removed, setRemoved] = useState(false)
  // 재접속 시 join 응답보다 화면의 입력이 최신이다(끊긴 동안 보낸 저장은 새 소켓에서 버려진다).
  const latestGameState = useRef(null)
  latestGameState.current = gameState
  const removedRef = useRef(false)
  removedRef.current = removed

  useEffect(() => {
    if (!hasProfile) navigate(joinPath, { replace: true })
  }, [hasProfile, joinPath, navigate])

  useEffect(() => {
    if (!socket || !hasProfile) return

    function join() {
      if (removedRef.current) return
      socket.emit('join-class-pool', { classId, playerUuid: getPlayerUuid(), name, affiliation, character }, res => {
        if (!res?.ok) {
          if (res?.error === 'NOT_COMPETITION') {
            const params = new URLSearchParams({ affiliation, name, character, classId })
            navigate(`/lobby?${params}`, { replace: true })
          }
          return
        }
        if (res.state === 'submitted') {
          navigate(`/result/${res.sessionId}`, { replace: true })
          return
        }
        // 끊긴 동안 관리자가 입력 완료로 바꿨다면 화면의 예전 입력으로 되돌리지 않는다.
        const adminCompleted = res.gameState?.isCompleted && !latestGameState.current?.isCompleted
        if (latestGameState.current && !adminCompleted) {
          socket.emit('update-pool-player-state', { classId, gameState: latestGameState.current })
          return
        }
        setGameState(withPrices(res.gameState))
        setSyncToken(t => t + 1)
      })
    }

    join()
    socket.on('connect', join)
    return () => socket.off('connect', join)
  }, [socket, hasProfile, classId, name, affiliation, character, navigate])

  useEffect(() => {
    if (!socket) return
    const onSubmitted = ({ sessionId }) => navigate(`/result/${sessionId}`)
    const onKicked = () => setRemoved(true)
    // 관리자가 이 참여자의 입력을 직접 고쳤을 때
    const onStateUpdated = ({ gameState: next }) => {
      setGameState(withPrices(next))
      setSyncToken(t => t + 1)
    }
    socket.on('game-submitted', onSubmitted)
    socket.on('player-state-updated', onStateUpdated)
    socket.on('you-were-kicked', onKicked)
    return () => {
      socket.off('game-submitted', onSubmitted)
      socket.off('player-state-updated', onStateUpdated)
      socket.off('you-were-kicked', onKicked)
    }
  }, [socket, navigate])

  function save(next) {
    setGameState(next)
    socket?.emit('update-pool-player-state', { classId, gameState: next })
  }

  if (removed) {
    return (
      <AlertModal
        title="참여 명단에서 빠졌어요"
        message="선생님께 확인한 뒤 QR 코드로 다시 들어와 주세요."
        onConfirm={() => navigate(joinPath)}
      />
    )
  }

  if (!gameState) return null

  if (gameState.isCompleted) {
    return (
      <div className={styles.page}>
        <div className={styles.waitBody}>
          <img src={`/characters/${character}.png`} alt={name} className={styles.character} />
          <h1 className={styles.name}>{name}</h1>
          <p className={styles.message}>결과가 곧 나올 예정이니, 나가거나 화면을 끄지 마시고 조금만 기다려주세요</p>
        </div>
        <div className={styles.bottomBar}>
          <button type="button" className={styles.retryBtn} onClick={() => save({ ...gameState, isCompleted: false })}>
            다시 입력하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${inputStyles.page} ${inputStyles.pageFill}`}>
      <AssetInputSteps editablePrices gameState={gameState} syncToken={syncToken} onChange={save} onComplete={save} />
    </div>
  )
}
