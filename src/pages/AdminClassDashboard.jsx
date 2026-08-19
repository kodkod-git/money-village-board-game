import { useState, useEffect, useCallback, useMemo } from 'react'
import AdminGridView from '../components/admin/AdminGridView'
import AdminTableView from '../components/admin/AdminTableView'
import AdminSpectateModal from '../components/admin/AdminSpectateModal'
import ClassQRModal from '../components/admin/ClassQRModal'
import AdminStatCards from '../components/admin/AdminStatCards'
import AdminEmptyState from '../components/admin/AdminEmptyState'
import { adminFetch } from '../utils/adminAuth'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './AdminDashboard.module.css'

const TABS = [
  { key: 'grid', label: '그리드 뷰', icon: '/icons/IconGrid.png' },
  { key: 'table', label: '테이블 뷰', icon: '/icons/IconTable.png' },
]

function matchesSearch(room, query) {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (room.title?.toLowerCase().includes(q)) return true
  if (room.code?.toLowerCase().includes(q)) return true
  return room.players.some(p => p?.name?.toLowerCase().includes(q))
}

export default function AdminClassDashboard({ classId, initialName }) {
  const { socket } = useSocketContext()
  const [activeTab, setActiveTab] = useState('grid')
  const [rooms, setRooms] = useState([])
  const [spectateIndex, setSpectateIndex] = useState(null)
  const [name, setName] = useState(initialName)
  const [showQr, setShowQr] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isBulkRegistering, setIsBulkRegistering] = useState(false)
  const [search, setSearch] = useState('')

  const loadRooms = useCallback(() => {
    adminFetch(`/api/admin/rooms?classId=${encodeURIComponent(classId)}`)
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
  }, [classId])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

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
        alert(error || '방 생성에 실패했습니다')
        return
      }
      loadRooms()
    } catch {
      alert('방 생성에 실패했습니다')
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
        alert(error || '일괄 결과등록에 실패했습니다')
        return
      }
      const { total } = await res.json()
      if (total === 0) alert('등록 대기 중인 팀이 없습니다')
      loadRooms()
    } catch {
      alert('일괄 결과등록에 실패했습니다')
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
          <button
            className={styles.bulkRegisterBtn}
            onClick={handleBulkRegister}
            disabled={isBulkRegistering}
            type="button"
          >
            <img src="/icons/IconRegister.png" alt="" className={styles.btnIcon} />
            <span>전체 등록</span>
          </button>
        </div>
      </div>

      <AdminStatCards rooms={rooms} />

      {showQr && <ClassQRModal classId={classId} name={name} onClose={() => setShowQr(false)} />}

      {confirmDeleteAll && (
        <div className={styles.overlay} onClick={() => setConfirmDeleteAll(false)}>
          <div className={styles.confirmPopup} onClick={e => e.stopPropagation()}>
            <p className={styles.confirmText}>
              이 수업의 모든 팀을 삭제하면 되돌릴 수 없습니다.<br />삭제하시겠습니까?
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmCancelBtn} onClick={() => setConfirmDeleteAll(false)}>취소</button>
              <button type="button" className={styles.confirmDeleteBtn} onClick={handleConfirmDeleteAll}>삭제</button>
            </div>
          </div>
        </div>
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
              onSpectate={room => setSpectateIndex(rooms.findIndex(r => r.code === room.code))}
              onCreate={classId === 'unassigned' ? undefined : handleCreateRoom}
              onRoomChanged={loadRooms}
            />
          )}
          {activeTab === 'table' && (
            <AdminTableView rooms={filteredRooms} onDeletePlayers={handleDeleteSelectedPlayers} />
          )}
        </>
      )}

      {spectateIndex !== null && (
        <div className={styles.overlay} onClick={() => setSpectateIndex(null)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <AdminSpectateModal
              rooms={rooms}
              initialIndex={spectateIndex}
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
