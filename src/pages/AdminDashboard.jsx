import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGridView from '../components/admin/AdminGridView'
import AdminTableView from '../components/admin/AdminTableView'
import Lobby from './Lobby'
import { ADMIN_MOCK_ROOMS } from '../data/adminMockData'
import styles from './AdminDashboard.module.css'

const TABS = [
  { key: 'grid', label: '그리드 뷰' },
  { key: 'table', label: '테이블 뷰' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('grid')
  const [spectatingRoom, setSpectatingRoom] = useState(null)

  useEffect(() => {
    document.body.classList.add('admin-mode')
    return () => document.body.classList.remove('admin-mode')
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>관리자 모드</h1>
          <p className={styles.subtitle}>데모 버전 — 목업 데이터로 동작합니다</p>
        </div>
        <button className={styles.exitBtn} onClick={() => navigate('/')} type="button">
          ← 나가기
        </button>
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
        <AdminGridView rooms={ADMIN_MOCK_ROOMS} onSpectate={setSpectatingRoom} />
      )}
      {activeTab === 'table' && <AdminTableView rooms={ADMIN_MOCK_ROOMS} />}

      {spectatingRoom && (
        <div className={styles.overlay} onClick={() => setSpectatingRoom(null)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <button
              className={styles.closeBtn}
              onClick={() => setSpectatingRoom(null)}
              aria-label="닫기"
              type="button"
            >
              ×
            </button>
            <Lobby readOnly mockRoom={spectatingRoom} />
          </div>
        </div>
      )}
    </div>
  )
}
