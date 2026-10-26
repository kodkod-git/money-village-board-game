import { useState, useEffect, useCallback, useMemo } from 'react'
import AdminGridView from '../components/admin/AdminGridView'
import AdminTableView from '../components/admin/AdminTableView'
import AdminSpectateModal from '../components/admin/AdminSpectateModal'
import ClassQRModal from '../components/admin/ClassQRModal'
import SurveyQRModal from '../components/admin/SurveyQRModal'
import AdminStatCards from '../components/admin/AdminStatCards'
import AdminEmptyState from '../components/admin/AdminEmptyState'
import TypeDistribution from '../components/admin/TypeDistribution'
import ConfirmDialog from '../components/admin/ConfirmDialog'
import CompetitionPoolBlock from '../components/admin/CompetitionPoolBlock'
import { competitionReadiness } from '../utils/competitionReadiness'
import { adminFetch } from '../utils/adminAuth'
import { toast } from '../utils/toast'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './AdminDashboard.module.css'

const TABS = [
  { key: 'grid', label: '그리드 뷰', icon: '/icons/IconGrid.png' },
  { key: 'table', label: '테이블 뷰', icon: '/icons/IconTable.png' },
  { key: 'chart', label: '유형 분포 뷰', icon: '/icons/IconChart.svg' },
]

function matchesSearch(room, query) {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (room.title?.toLowerCase().includes(q)) return true
  if (room.code?.toLowerCase().includes(q)) return true
  return room.players.some(p => p?.name?.toLowerCase().includes(q))
}

export default function AdminClassDashboard({ classId, initialName, mode = 'normal' }) {
  const competition = mode === 'competition'
  const { socket } = useSocketContext()
  const [activeTab, setActiveTab] = useState('grid')
  const [rooms, setRooms] = useState([])
  const [spectateIndex, setSpectateIndex] = useState(null)
  const [name, setName] = useState(initialName)
  const [showQr, setShowQr] = useState(false)
  const [showSurveyQr, setShowSurveyQr] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [confirmBulkRegister, setConfirmBulkRegister] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isBulkRegistering, setIsBulkRegistering] = useState(false)
  const [search, setSearch] = useState('')
  // 유형 분포 뷰는 이 수업에서 결과 등록을 마친 참가자만 보여 준다.
  const [results, setResults] = useState(null)
  const [resultsError, setResultsError] = useState(false)
  // 경쟁 모드: QR로 들어왔지만 아직 팀에 배정되지 않은 참여자
  const [pool, setPool] = useState([])
  const [poolDeleteTarget, setPoolDeleteTarget] = useState(null)

  const loadRooms = useCallback(() => {
    adminFetch(`/api/admin/rooms?classId=${encodeURIComponent(classId)}`)
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
    if (competition) {
      adminFetch(`/api/admin/classes/${encodeURIComponent(classId)}/pool`)
        .then(r => r.json())
        .then(setPool)
        .catch(() => {})
    }
  }, [classId, competition])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  // 팀 상태가 바뀌면(결과 등록 등) rooms가 다시 내려오므로 그때마다 결과도 새로 받는다.
  useEffect(() => {
    if (activeTab !== 'chart') return
    let cancelled = false
    setResultsError(false)
    fetch(`/api/rankings?classId=${encodeURIComponent(classId)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (!cancelled) setResults(data) })
      .catch(() => { if (!cancelled) setResultsError(true) })
    return () => { cancelled = true }
  }, [activeTab, classId, rooms])

  useEffect(() => {
    if (!socket || !classId) return
    socket.emit('watch-class-rooms', { classId })
    socket.on('class-rooms-updated', loadRooms)
    return () => {
      socket.emit('unwatch-class-rooms', { classId })
      socket.off('class-rooms-updated', loadRooms)
    }
  }, [socket, classId, loadRooms])

  const filteredRooms = useMemo(() => rooms.filter(room => matchesSearch(room, search)), [rooms, search])
  const hasDisconnectedPendingTeam = rooms.some(room =>
    room.status === 'completed-but-unregistered' && !room.registered &&
    room.players.some(p => p?.connected === false)
  )
  const readiness = competition ? competitionReadiness(pool, rooms) : null
  const registerLabel = competition ? '결과 등록' : '전체 등록'

  async function handleCreateRoom() {
    if (isCreating) return
    setIsCreating(true)
    try {
      const res = await adminFetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        toast(error || '방 생성에 실패했습니다')
        return
      }
      loadRooms()
    } catch {
      toast('방 생성에 실패했습니다')
    } finally {
      setIsCreating(false)
    }
  }

  function handlePlayerUpdate(code, updatedPlayer) {
    setRooms(prev => prev.map(room => {
      if (room.code !== code) return room
      return {
        ...room,
        players: room.players.map(p => (p.playerUuid === updatedPlayer.playerUuid ? updatedPlayer : p)),
      }
    }))
  }

  async function handleTitleBlur() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === initialName) return
    const res = await adminFetch(`/api/admin/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    if (!res.ok) setName(initialName)
  }

  async function handleBulkRegister() {
    if (isBulkRegistering) return
    setIsBulkRegistering(true)
    try {
      const res = await adminFetch(`/api/admin/classes/${classId}/submit-pending`, { method: 'POST' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        toast(error || '일괄 결과등록에 실패했습니다')
        return
      }
      const { total } = await res.json()
      if (total === 0) toast('등록 대기 중인 팀이 없습니다')
      loadRooms()
    } catch {
      toast('일괄 결과등록에 실패했습니다')
    } finally {
      setIsBulkRegistering(false)
    }
  }

  async function handleConfirmDeleteAll() {
    setConfirmDeleteAll(false)
    await Promise.all(rooms.map(room => adminFetch(`/api/admin/rooms/${room.code}`, { method: 'DELETE' })))
    loadRooms()
  }

  async function handleDeleteSelectedPlayers(entries) {
    await Promise.all(
      entries.map(({ roomCode, playerUuid }) =>
        adminFetch(`/api/admin/rooms/${roomCode}/players/${playerUuid}`, { method: 'DELETE' })
      )
    )
    loadRooms()
  }

  async function handleAssign(playerUuid, toRoomCode) {
    try {
      const res = await adminFetch(`/api/admin/classes/${classId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerUuid, toRoomCode }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        toast(error || '팀 배정에 실패했습니다')
      }
    } catch {
      toast('팀 배정에 실패했습니다')
    }
    loadRooms()
  }

  async function handleConfirmDeletePoolPlayer() {
    const target = poolDeleteTarget
    setPoolDeleteTarget(null)
    try {
      const res = await adminFetch(`/api/admin/classes/${classId}/pool/${target.playerUuid}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        toast(error || '참여자 삭제에 실패했습니다')
      }
    } catch {
      toast('참여자 삭제에 실패했습니다')
    }
    loadRooms()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <span className={styles.editIcon} aria-hidden="true">✏️</span>
            <input
              className={styles.titleInput}
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleTitleBlur}
            />
          </div>
          <p className={styles.subtitle}>진행중인 팀과 완료한 팀을 확인하고 수정할 수 있습니다</p>
        </div>
        <div className={styles.headerActions}>
          <input
            className={styles.searchInput}
            placeholder="이름 또는 팀 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={styles.viewToggle}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                aria-label={tab.label}
                className={`${styles.viewToggleBtn} ${activeTab === tab.key ? styles.viewToggleBtnActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span
                  className={styles.viewToggleIcon}
                  style={{ WebkitMaskImage: `url(${tab.icon})`, maskImage: `url(${tab.icon})` }}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
          <button className={styles.qrBtn} onClick={() => setShowSurveyQr(true)} type="button">만족도 조사</button>
          <button className={styles.qrBtn} onClick={() => setShowQr(true)} type="button">QR 코드</button>
          <button
            className={styles.deleteAllBtn}
            onClick={() => setConfirmDeleteAll(true)}
            disabled={rooms.length === 0}
            type="button"
          >
            <img src="/icons/IconDelete.png" alt="" className={styles.btnIcon} />
            <span>전체 삭제</span>
          </button>
          {readiness && !readiness.ready && (
            <span className={styles.registerReason}>{readiness.reason}</span>
          )}
          <button
            className={styles.bulkRegisterBtn}
            onClick={() => setConfirmBulkRegister(true)}
            disabled={isBulkRegistering || (readiness !== null && !readiness.ready)}
            type="button"
          >
            <img src="/icons/IconRegister.png" alt="" className={styles.btnIcon} />
            <span>{registerLabel}</span>
          </button>
        </div>
      </div>

      {rooms.length > 0 && <AdminStatCards rooms={rooms} />}
      {competition && (
        <CompetitionPoolBlock players={pool} onAssign={handleAssign} onDelete={setPoolDeleteTarget} />
      )}

      {showQr && <ClassQRModal classId={classId} name={name} onClose={() => setShowQr(false)} />}
      {showSurveyQr && <SurveyQRModal onClose={() => setShowSurveyQr(false)} />}

      {confirmDeleteAll && (
        <ConfirmDialog
          tone="danger"
          title="전체 삭제"
          description={<>이 수업의 모든 팀을 삭제하면 되돌릴 수 없습니다.<br />삭제하시겠습니까?</>}
          onCancel={() => setConfirmDeleteAll(false)}
          onConfirm={handleConfirmDeleteAll}
        />
      )}

      {confirmBulkRegister && (
        <ConfirmDialog
          tone="primary"
          title={registerLabel}
          description={
            competition
              ? '모든 팀의 결과를 등록하고 참여자에게 결과 화면을 보여줄까요?'
              : hasDisconnectedPendingTeam
                ? '연결끊김 상태인 참가자가 존재하고, 일부 참여자에게는 결과화면이 나오지 않을 수 있습니다. 그래도 진행하시겠습니까?'
                : '등록 대기 중인 팀을 모두 결과 등록하시겠습니까?'
          }
          onCancel={() => setConfirmBulkRegister(false)}
          onConfirm={() => { setConfirmBulkRegister(false); handleBulkRegister() }}
        />
      )}

      {poolDeleteTarget && (
        <ConfirmDialog
          tone="danger"
          title="참여자 삭제"
          description={<>'{poolDeleteTarget.name}' 참여자를 명단에서 삭제할까요?<br />입력한 내용도 함께 사라집니다.</>}
          confirmLabel="삭제"
          onCancel={() => setPoolDeleteTarget(null)}
          onConfirm={handleConfirmDeletePoolPlayer}
        />
      )}

      {rooms.length === 0 ? (
        <AdminEmptyState
          title="등록된 팀 정보가 없습니다."
          subtitle="팀을 등록하면 팀 현황을 확인할 수 있습니다."
          actionLabel={classId !== 'unassigned' ? '팀 등록' : undefined}
          onAction={classId !== 'unassigned' ? handleCreateRoom : undefined}
        />
      ) : (
        <>
          {activeTab === 'grid' && (
            <AdminGridView
              rooms={filteredRooms}
              allRooms={rooms}
              onSpectate={room => setSpectateIndex(rooms.findIndex(r => r.code === room.code))}
              onCreate={classId === 'unassigned' ? undefined : handleCreateRoom}
              onRoomChanged={loadRooms}
              competition={competition}
              onAssign={competition ? handleAssign : undefined}
            />
          )}
          {activeTab === 'table' && (
            <AdminTableView rooms={filteredRooms} onDeletePlayers={handleDeleteSelectedPlayers} />
          )}
          {activeTab === 'chart' && resultsError && (
            <p className={styles.chartMessage}>결과를 불러오는 중 오류가 발생했습니다.</p>
          )}
          {activeTab === 'chart' && !resultsError && results === null && (
            <p className={styles.chartMessage}>불러오는 중...</p>
          )}
          {activeTab === 'chart' && !resultsError && results?.length === 0 && (
            <AdminEmptyState title="등록된 게임 결과가 없습니다." subtitle="팀 결과를 등록하면 유형 분포를 확인할 수 있습니다." />
          )}
          {activeTab === 'chart' && !resultsError && results?.length > 0 && (
            <TypeDistribution rows={results} scopeLabel="수업" largePoints />
          )}
        </>
      )}

      {spectateIndex !== null && (
        <div className={styles.overlay} onClick={() => setSpectateIndex(null)}>
          <div className={`${styles.popup} ${styles.spectatePopup}`} onClick={e => e.stopPropagation()}>
            <AdminSpectateModal
              rooms={rooms}
              initialIndex={spectateIndex}
              competition={competition}
              onPlayerUpdate={handlePlayerUpdate}
              onClose={() => setSpectateIndex(null)}
              onRoomChanged={loadRooms}
            />
          </div>
        </div>
      )}
    </div>
  )
}
