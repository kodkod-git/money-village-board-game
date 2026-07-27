import { useState, useEffect, useCallback } from 'react'
import AdminGridView from '../components/admin/AdminGridView'
import AdminTableView from '../components/admin/AdminTableView'
import AdminSpectateModal from '../components/admin/AdminSpectateModal'
import { adminFetch } from '../utils/adminAuth'
import styles from './AdminDashboard.module.css'

const TABS = [
  { key: 'grid', label: '그리드 뷰' },
  { key: 'table', label: '테이블 뷰' },
]

export default function AdminClassDashboard({ classId, initialName, onBack }) {
  const [activeTab, setActiveTab] = useState('grid')
  const [rooms, setRooms] = useState([])
  const [spectateIndex, setSpectateIndex] = useState(null)
  const [name, setName] = useState(initialName)

  const loadRooms = useCallback(() => {
    adminFetch(`/api/admin/rooms?classId=${encodeURIComponent(classId)}`)
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
  }, [classId])

  useEffect(() => {
    document.body.classList.add('admin-mode')
    loadRooms()
    return () => document.body.classList.remove('admin-mode')
  }, [loadRooms])

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <input
            className={styles.titleInput}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleTitleBlur}
          />
          <p className={styles.subtitle}>진행중인 팀과 완료된 팀을 확인하고 수정할 수 있습니다</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadRooms} type="button">↻ 새로고침</button>
          <button className={styles.exitBtn} onClick={onBack} type="button">← 수업 목록</button>
        </div>
      </div>

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
        <AdminGridView rooms={rooms} onSpectate={room => setSpectateIndex(rooms.findIndex(r => r.code === room.code))} />
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
