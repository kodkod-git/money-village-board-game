import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '../utils/adminAuth'
import ClassQRModal from '../components/admin/ClassQRModal'
import SurveyQRModal from '../components/admin/SurveyQRModal'
import ConfirmDialog from '../components/admin/ConfirmDialog'
import AdminOverflowMenu from '../components/admin/AdminOverflowMenu'
import useIsAdminMobile from '../hooks/useIsAdminMobile'
import styles from './AdminClassList.module.css'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('ko-KR')
}

export default function AdminClassList({ profile, onSelectClass, onLogout }) {
  const [classes, setClasses] = useState([])
  const [newClassName, setNewClassName] = useState('')
  const [newContestName, setNewContestName] = useState('')
  const [error, setError] = useState('')
  const [qrClass, setQrClass] = useState(null)
  const [showSurveyQr, setShowSurveyQr] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showEmptyNameWarning, setShowEmptyNameWarning] = useState(false)
  const isMobile = useIsAdminMobile()

  const loadClasses = useCallback(() => {
    adminFetch('/api/admin/classes')
      .then(r => r.json())
      .then(setClasses)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  async function createEntry(kind, rawName, reset) {
    if (!rawName.trim()) {
      setShowEmptyNameWarning(kind)
      return
    }
    setError('')
    const body = kind === 'official' ? { name: rawName.trim(), kind } : { name: rawName.trim() }
    const res = await adminFetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다')
      return
    }
    reset('')
    loadClasses()
  }

  function handleCreateClass(e) {
    e.preventDefault()
    createEntry('class', newClassName, setNewClassName)
  }

  function handleCreateContest(e) {
    e.preventDefault()
    createEntry('official', newContestName, setNewContestName)
  }

  async function handleConfirmDelete() {
    const res = await adminFetch(`/api/admin/classes/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    if (!res.ok) return
    loadClasses()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>게임 목록</h1>
        <div className={styles.headerActions}>
          <span className={styles.username}>{profile.username}</span>
          <button type="button" className={styles.logoutBtn} onClick={onLogout}>로그아웃</button>
        </div>
      </div>

      <div className={styles.createGrid}>
        <form className={styles.createColumn} onSubmit={handleCreateClass}>
          <span className={styles.createLabel}>수업</span>
          <div className={styles.createForm}>
            <input
              className={styles.createInput}
              placeholder="새 수업 이름"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
            />
            <button type="submit" className={styles.createBtn}>수업 생성하기</button>
          </div>
        </form>
        <form className={styles.createColumn} onSubmit={handleCreateContest}>
          <span className={styles.createLabel}>대회 (공식전)</span>
          <div className={styles.createForm}>
            <input
              className={styles.createInput}
              placeholder="새 대회 이름"
              value={newContestName}
              onChange={e => setNewContestName(e.target.value)}
            />
            <button type="submit" className={styles.createBtn}>대회 생성하기</button>
          </div>
        </form>
      </div>
      {error && <p className={styles.error}>{error}</p>}

      <ul className={styles.list}>
        {classes.map(cls => (
          <li key={cls.id} className={styles.item}>
            <button type="button" className={styles.itemBtn} onClick={() => onSelectClass({ id: cls.id, name: cls.name, kind: cls.kind ?? 'class' })}>
              <span className={styles.itemName}>
                {cls.name}
                {cls.kind === 'official' && <span className={styles.officialBadge}>공식</span>}
              </span>
              {cls.createdAt && <span className={styles.itemDate}>{formatDate(cls.createdAt)}</span>}
            </button>
            {cls.id !== 'unassigned' && (isMobile ? (
              <AdminOverflowMenu
                label={`${cls.name} 메뉴`}
                items={[
                  { key: 'survey', label: '만족도 조사', onSelect: () => setShowSurveyQr(true) },
                  { key: 'qr', label: 'QR', onSelect: () => setQrClass(cls) },
                  { key: 'delete', label: '삭제', danger: true, onSelect: () => setDeleteTarget(cls) },
                ]}
              />
            ) : (
              <>
                <button type="button" className={styles.qrBtn} onClick={() => setShowSurveyQr(true)}>만족도 조사</button>
                <button type="button" className={styles.qrBtn} onClick={() => setQrClass(cls)}>QR</button>
                <button type="button" className={styles.deleteBtn} onClick={() => setDeleteTarget(cls)}>삭제</button>
              </>
            ))}
          </li>
        ))}
      </ul>

      {qrClass && <ClassQRModal classId={qrClass.id} name={qrClass.name} onClose={() => setQrClass(null)} />}
      {showSurveyQr && <SurveyQRModal onClose={() => setShowSurveyQr(false)} />}

      {deleteTarget && (
        <ConfirmDialog
          tone="danger"
          title={deleteTarget.kind === 'official' ? '대회 삭제' : '수업 삭제'}
          description={<>'{deleteTarget.name}' {deleteTarget.kind === 'official' ? '대회를' : '수업을'} 삭제하면 관련된 모든 팀 기록도 함께 삭제되며 되돌릴 수 없습니다.<br />삭제하시겠습니까?</>}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showEmptyNameWarning && (
        <ConfirmDialog
          tone="primary"
          title="알림"
          description={showEmptyNameWarning === 'official' ? '대회 이름을 입력해주세요' : '수업 이름을 입력해주세요'}
          confirmLabel="확인"
          hideCancel
          onCancel={() => setShowEmptyNameWarning(false)}
          onConfirm={() => setShowEmptyNameWarning(false)}
        />
      )}
    </div>
  )
}
