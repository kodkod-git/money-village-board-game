import { useState, useEffect, useCallback } from 'react'
import AdminGridView from '../components/admin/AdminGridView'
import AdminTableView from '../components/admin/AdminTableView'
import AdminSpectateModal from '../components/admin/AdminSpectateModal'
import ClassQRModal from '../components/admin/ClassQRModal'
import { adminFetch } from '../utils/adminAuth'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './AdminDashboard.module.css'

const TABS = [
  { key: 'grid', label: '그리드 뷰' },
  { key: 'table', label: '테이블 뷰' },
]

export default function AdminClassDashboard({ classId, initialName, onBack }) {
  const { socket } = useSocketContext()
  const [activeTab, setActiveTab] = useState('grid')
  const [rooms, setRooms] = useState([])
  const [spectateIndex, setSpectateIndex] = useState(null)
  const [name, setName] = useState(initialName)
  const [showQr, setShowQr] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

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

  async function handleConfirmDelete() {
    const res = await adminFetch(`/api/admin/classes/${classId}`, { method: 'DELETE' })
    setConfirmDelete(false)
    if (!res.ok) return
    onBack()
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
          <p className={styles.subtitle}>진행중인 팀과 완료된 팀을 확인하고 수정할 수 있습니다</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadRooms} type="button">↻ 새로고침</button>
          <button className={styles.qrBtn} onClick={() => setShowQr(true)} type="button">QR 코드</button>
          {classId !== 'unassigned' && (
            <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)} type="button">수업 삭제</button>
          )}
          <button className={styles.exitBtn} onClick={onBack} type="button">← 수업 목록</button>
        </div>
      </div>

      {showQr && <ClassQRModal classId={classId} name={name} onClose={() => setShowQr(false)} />}

      {confirmDelete && (
        <div className={styles.overlay} onClick={() => setConfirmDelete(false)}>
          <div className={styles.confirmPopup} onClick={e => e.stopPropagation()}>
            <p className={styles.confirmText}>
              '{name}' 수업을 삭제하면 관련된 모든 팀 기록도 함께 삭제되며 되돌릴 수 없습니다.<br />삭제하시겠습니까?
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmCancelBtn} onClick={() => setConfirmDelete(false)}>취소</button>
              <button type="button" className={styles.confirmDeleteBtn} onClick={handleConfirmDelete}>정말 삭제</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'grid' && (
        <AdminGridView
          rooms={rooms}
          onSpectate={room => setSpectateIndex(rooms.findIndex(r => r.code === room.code))}
          onCreate={classId === 'unassigned' ? undefined : handleCreateRoom}
        />
      )}
      {activeTab === 'table' && <AdminTableView rooms={rooms} />}

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
